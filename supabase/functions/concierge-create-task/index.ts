import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendOpsAlert } from "../_shared/ops-alert.ts";
import type { TransferAlertData } from "../_shared/ops-alert.ts";
import { AIRPORT_LOOKUP, STATION_LOOKUP, haversineKm } from "../_shared/transfer-lookups.ts";
import { computeTransferGbp } from "../_shared/transfer-rate-card.ts";
import { lockCharge } from "../_shared/fx-lock.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "restaurant_reservation",
  "scenic_tickets",
  "virtual_queue",
  "trip_planning",
  "hospital_booking",
  "chinese_number_required",
  "transfer",
  "other",
];

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => null);
    const summary = String(body?.summary ?? "").trim();
    const details = body?.details ? String(body.details).slice(0, 4000) : null;
    const category = CATEGORIES.includes(body?.category) ? body.category : "other";
    const city = body?.city ? String(body.city).slice(0, 80) : null;

    // Structured details for booking types that carry form data (transfers).
    // Accept only a plain object and cap the serialised size to 8 KB.
    let detailsJson: Record<string, unknown> | null = null;
    if (body?.details_json && typeof body.details_json === "object" && !Array.isArray(body.details_json)) {
      const serialised = JSON.stringify(body.details_json);
      if (serialised.length <= 8_000) detailsJson = body.details_json;
    }

    if (!summary || summary.length < 4 || summary.length > 280) {
      return new Response(JSON.stringify({ error: "summary required (4–280 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Booking-fee model. A restaurant booking request either counts against
    // an active entitlement (£9.99 authorised, up to 5 confirmed bookings
    // for the trip) or it becomes the fee-carrying request itself: priced,
    // authorised with manual capture, and only captured when ops confirms
    // the first booking. The entitlement row is created by the webhook on
    // authorisation — the traveller can queue further requests from that
    // moment on.
    const isRestaurant = category === "restaurant_reservation";
    let entitlementId: string | null = null;
    let needsBookingFee = false;
    // First restaurant request per traveller is free, for good — once per
    // user, never per trip and never renewed by an expired entitlement. The
    // free booking is consumed on SUBMIT (claimed with an `is null` guard so
    // two concurrent submits can't both win), and only restored if WE fail
    // the booking (see concierge-update-task).
    let usedFreeBooking = false;
    if (isRestaurant) {
      const { data: state, error: stateErr } = await admin
        .rpc("booking_entitlement_state", { user_uuid: auth.userId });
      if (stateErr) {
        console.error("booking entitlement lookup failed:", stateErr);
        return new Response(JSON.stringify({ error: "Couldn't verify booking access" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const active = Array.isArray(state) ? state[0] : state;
      if (active?.id) {
        entitlementId = active.id as string;
      } else {
        // Free first booking is set aside. FREE_FIRST_BOOKING_MODE:
        //   "grandfathered" (default) — only accounts created before the cut-over
        //   "all" — restores the original behaviour; "off" — nobody.
        const mode = (Deno.env.get("FREE_FIRST_BOOKING_MODE") ?? "grandfathered").toLowerCase();
        let claimQuery = admin
          .from("profiles")
          .update({ free_booking_used_at: new Date().toISOString() })
          .eq("user_id", auth.userId)
          .is("free_booking_used_at", null);
        if (mode === "off") claimQuery = claimQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
        else if (mode !== "all") claimQuery = claimQuery.lt("created_at", "2026-09-28T16:42:00Z");
        const { data: claimed, error: claimErr } = await claimQuery
          .select("user_id")
          .maybeSingle();
        if (claimErr) {
          console.error("free booking claim failed:", claimErr);
          return new Response(JSON.stringify({ error: "Couldn't verify booking access" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (claimed?.user_id) usedFreeBooking = true;
        else needsBookingFee = true;
      }
    }

    // A traveller may never hold two open £9.99 authorisations. If a fee
    // request is already awaiting authorisation, hand that one back instead
    // of minting a second priced task. The client reopens its payment
    // dialog; once authorised, the entitlement covers further requests.
    if (needsBookingFee) {
      const { data: openFee } = await admin
        .from("concierge_tasks")
        .select("*")
        .eq("user_id", auth.userId)
        .eq("category", "restaurant_reservation")
        .eq("status", "pay_to_confirm")
        .is("authorized_at", null)
        .is("paid_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openFee?.id) {
        return new Response(
          JSON.stringify({ task: openFee, fee_authorisation_pending: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Transfers now lock a fixed GBP price at booking and go straight to
    // pay_to_confirm — the customer must pay upfront before ops sees the
    // request. Other categories still carry a fixed ¥30 assistant fee and
    // start in `pending` for ops to claim.
    const isTransfer = category === "transfer";

    // Server-side authoritative price + FX lock for transfers. We never
    // trust a client-supplied amount — ops's rate card is the source.
    let insertPayload: Record<string, unknown> = {
      user_id: auth.userId,
      summary,
      details,
      details_json: detailsJson,
      category,
      city,
      price_cents: isTransfer ? 0 : 3000,
      currency: "CNY",
      status: "pending",
      entitlement_id: entitlementId,
    };

    // Free first booking — no price, no payment step, straight to ops.
    if (usedFreeBooking) {
      insertPayload = { ...insertPayload, price_cents: 0, currency: "GBP", status: "pending" };
    }

    // Restaurant booking fee — flat £9.99, locked into the traveller's
    // preferred currency using the same FX lock as transfers.
    if (needsBookingFee) {
      const BOOKING_FEE_GBP_CENTS = 999;
      const { data: owner } = await admin
        .from("profiles")
        .select("preferred_currency")
        .eq("user_id", auth.userId)
        .maybeSingle();
      let locked;
      try {
        locked = await lockCharge(
          BOOKING_FEE_GBP_CENTS,
          (owner?.preferred_currency as string | null) ?? null,
        );
      } catch (e) {
        console.error("booking fee FX lock failed:", e);
        return new Response(
          JSON.stringify({ error: "Couldn't lock the price — try again in a moment." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      insertPayload = {
        ...insertPayload,
        price_cents: BOOKING_FEE_GBP_CENTS,
        currency: "GBP",
        status: "pay_to_confirm",
        charge_amount_cents: locked.charge_amount_cents,
        charge_currency: locked.charge_currency,
        fx_rate_used: locked.fx_rate_used,
        quoted_gbp_cents: locked.quoted_gbp_cents,
      };
    }

    if (isTransfer) {
      if (!detailsJson || (detailsJson as { kind?: string }).kind !== "transfer") {
        return new Response(JSON.stringify({ error: "transfer details required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const dj = detailsJson as Record<string, unknown>;
      const svc = String(dj.service ?? "");
      const carClass = String(dj.car_class ?? "");
      const hours = typeof dj.hours === "number" ? (dj.hours as number) : undefined;
      if (svc !== "airport" && svc !== "hourly" && svc !== "station") {
        return new Response(JSON.stringify({ error: "invalid transfer service" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const validClasses = ["standard", "premium", "van", "first", "maybach"] as const;
      if (!(validClasses as readonly string[]).includes(carClass)) {
        return new Response(JSON.stringify({ error: "invalid car class" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const routeCode =
        svc === "airport"
          ? String(dj.airport_code ?? "")
          : svc === "station"
            ? String(dj.station_code ?? "")
            : null;
      const gbp = computeTransferGbp(
        svc as "airport" | "hourly" | "station",
        carClass as typeof validClasses[number],
        hours,
        routeCode,
      );
      if (gbp == null || gbp <= 0) {
        return new Response(JSON.stringify({ error: "unable to price transfer" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const quotedGbpCents = gbp * 100;

      // Lock the customer-facing charge in their preferred currency.
      const { data: owner } = await admin
        .from("profiles")
        .select("preferred_currency")
        .eq("user_id", auth.userId)
        .maybeSingle();
      let locked;
      try {
        locked = await lockCharge(
          quotedGbpCents,
          (owner?.preferred_currency as string | null) ?? null,
        );
      } catch (e) {
        console.error("FX lock failed:", e);
        return new Response(
          JSON.stringify({ error: "Couldn't lock the price — try again in a moment." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // The client sends the exact amount it displayed. The locked amount is
      // always authoritative — we only log divergence (rates can move between
      // viewing and booking); the client re-reads the locked amount from the
      // task and renders it on the payment card before any payment is taken.
      const shownCents = Number((body as Record<string, unknown>).quoted_charge_cents);
      const shownCurrency = String((body as Record<string, unknown>).quoted_charge_currency ?? "");
      if (
        Number.isFinite(shownCents) &&
        (shownCents !== locked.charge_amount_cents ||
          (shownCurrency && shownCurrency !== locked.charge_currency))
      ) {
        console.warn(
          `transfer quote drift: shown ${shownCurrency} ${shownCents} vs locked ${locked.charge_currency} ${locked.charge_amount_cents}`,
        );
      }

      insertPayload = {
        ...insertPayload,
        price_cents: quotedGbpCents,
        currency: "GBP",
        status: "pay_to_confirm",
        charge_amount_cents: locked.charge_amount_cents,
        charge_currency: locked.charge_currency,
        fx_rate_used: locked.fx_rate_used,
        quoted_gbp_cents: locked.quoted_gbp_cents,
      };
    }

    const { data: task, error } = await admin
      .from("concierge_tasks")
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      // The free booking was claimed before the insert — hand it back so a
      // failed insert never costs the traveller their one free booking.
      if (usedFreeBooking) {
        await admin
          .from("profiles")
          .update({ free_booking_used_at: null, free_booking_task_id: null })
          .eq("user_id", auth.userId)
          .is("free_booking_task_id", null);
      }
      // Concurrent case: the partial unique index rejected a second
      // unauthorised fee task. Re-read the winner and answer exactly as the
      // sequential path does.
      if (needsBookingFee && (error.code === "23505" || /duplicate key/i.test(error.message))) {
        const { data: winner } = await admin
          .from("concierge_tasks")
          .select("*")
          .eq("user_id", auth.userId)
          .eq("category", "restaurant_reservation")
          .eq("status", "pay_to_confirm")
          .is("authorized_at", null)
          .is("paid_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (winner?.id) {
          return new Response(
            JSON.stringify({ task: winner, fee_authorisation_pending: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      console.error("create task error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record which request consumed the free booking, so a later restore is
    // exact and idempotent.
    if (usedFreeBooking) {
      await admin
        .from("profiles")
        .update({ free_booking_task_id: task.id })
        .eq("user_id", auth.userId);
    }

    await admin.from("concierge_messages").insert({
      task_id: task.id,
      sender: "system",
      body: isTransfer
        ? "Pay below to request your driver — you'll only be charged once your car is confirmed."
        : needsBookingFee
          ? "Confirm the booking fee below to send this request. You're only charged once your first booking is confirmed."
          : usedFreeBooking
            ? "Request received — our team is contacting the restaurant. We'll confirm your table here shortly."
            : "Task received — finding a bilingual assistant. We'll reply here in under 5 minutes.",
    });

    // Fire-and-forget ops alert. Never blocks or fails the create flow.
    // Transfers now defer their ops alert until the customer pays — an
    // unpaid transfer isn't an ops job and won't reach the queue.
    // The booking-fee request is not an ops job until the card is
    // authorised — the webhook releases it into the queue and alerts ops.
    if (isTransfer || needsBookingFee) {
      return new Response(JSON.stringify({ task }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, phone")
        .eq("user_id", auth.userId)
        .maybeSingle();
      const displayName = profile?.display_name ?? "Unknown traveller";
      const contactPhone = profile?.phone ?? "";
      sendOpsAlert({
        event: "new_request",
        subject: usedFreeBooking
          ? `New request · ${category} · FIRST BOOKING (FREE)`
          : `New request · ${category}`,
        headline: usedFreeBooking
          ? "New concierge request — first booking, free"
          : "New concierge request",
        intro: summary,
        lines: [
          { label: "Category", value: category },
          ...(usedFreeBooking
            ? [{
                label: "Booking",
                value: "First booking (free) — customer hasn't paid, first impression of us",
              }]
            : []),
          ...(city ? [{ label: "City", value: city }] : []),
          { label: "Requester", value: displayName },
          ...(contactPhone ? [{ label: "Contact phone", value: contactPhone }] : []),
        ],
        taskId: task.id,
        category,
      });
    } catch (e) {
      console.warn("ops-alert dispatch (create) failed:", e);
    }

    return new Response(JSON.stringify({ task }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge-create-task error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
