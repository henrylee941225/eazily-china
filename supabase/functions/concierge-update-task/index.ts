import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendOpsAlert, type OpsAlertLine } from "../_shared/ops-alert.ts";
import { stripeRequest } from "../_shared/stripe.ts";
import { holdReleaseHours, isAuthorisationExpired, logHoldThresholds } from "../_shared/holdExpiry.ts";
import type { StripeEnv } from "../_shared/stripe.ts";
import { storedStripeEnv } from "../_shared/payments-env.ts";
import { TRIP_PASS_PITCH } from "../_shared/tripPassPitch.ts";
import { enqueueCustomerEmail } from "../_shared/customerEmail.ts";
import { notificationEmailHtml, notificationEmailText } from "../_shared/notificationEmail.ts";

// The Stripe mode a task's payment was CREATED in. Captures, refunds and hold
// releases must use exactly this — never the mode of whoever is calling us. A
// sandbox PaymentIntent touched with live credentials (or the reverse) is a
// silent money bug, so an unrecorded mode is a hard error, never a guess.
type EnvResolution = { env: StripeEnv } | { response: Response };
const resolveTaskStripeEnv = (task: Record<string, unknown>): EnvResolution => {
  const env = storedStripeEnv(task.stripe_env);
  if (env) return { env };
  console.error(
    `concierge-update-task: task ${String(task.id ?? "")} has no stripe_env — ` +
      `refusing to guess the payment environment. Handle manually in Stripe.`,
  );
  return {
    response: new Response(
      JSON.stringify({
        error: "Payment environment unknown for this task — handle manually in Stripe",
        code: "unknown_stripe_env",
      }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    ),
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Transfers start in `pay_to_confirm` and skip pending/confirming entirely.
// Ops never sets `pay_to_confirm` directly any more — the create flow does.
const ASSISTANT_ALLOWED = new Set([
  "in_progress",
  "confirming",
  "confirmed",
  "change_pending",
  "unavailable",
  "completed",
  "cancelled",
]);
// Owners can cancel outright or request a change (change_pending snapshots
// the current status via the shared previous_status branch below).
const OWNER_ALLOWED = new Set(["cancelled", "change_pending"]);
const TERMINAL = new Set(["unavailable", "cancelled", "completed"]);

// Copy is UK English, no emoji, no time promises.
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥", USD: "$", EUR: "€", GBP: "£", HKD: "HK$", JPY: "¥",
};
const fmtMoney = (cents: number, currency: string): string => {
  const cur = (currency || "GBP").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] ?? `${cur} `;
  const isZeroDecimal = cur === "JPY";
  const value = isZeroDecimal ? Math.round(cents) : cents / 100;
  const formatted = isZeroDecimal
    ? value.toLocaleString("en-GB")
    : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
};
const SYSTEM_COPY: Record<string, (ref?: string | null) => string> = {
  in_progress: () => "Task is now in progress.",
  confirming: () =>
    "A person is confirming your booking. We'll update you here the moment it's done.",
  confirmed: (ref) =>
    `Confirmed. Ref ${ref ?? ""}, held under your name. Show this on arrival.`,
  change_pending: () =>
    "We're confirming your change. Your original booking is still held.",
  unavailable: () =>
    "We couldn't secure this one. You haven't been charged — ask me for alternatives.",
  cancelled: () => "Cancelled. Nothing further needed.",
  completed: () => "Task marked complete by your assistant.",
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => null);
    const taskId = String(body?.task_id ?? "");
    const revert = body?.revert === true;
    const applyChange = body?.apply_change === true;
    const cantAccommodate = body?.cant_accommodate === true;
    const requestedStatus = String(body?.status ?? "");
    const bookingReference = body?.booking_reference
      ? String(body.booking_reference).trim().slice(0, 120)
      : null;

    // Structured driver dispatch payload — accepted only when confirming a
    // transfer task. All fields required for a valid dispatch card.
    const driverIn = body?.driver_details as
      | { name?: string; vehicle?: string; plate?: string; meeting_point?: string }
      | undefined;
    const cleanDriver = driverIn
      ? {
          name: String(driverIn.name ?? "").trim().slice(0, 120),
          vehicle: String(driverIn.vehicle ?? "").trim().slice(0, 160),
          plate: String(driverIn.plate ?? "").trim().slice(0, 40),
          meeting_point: String(driverIn.meeting_point ?? "").trim().slice(0, 200),
        }
      : null;

    // Structured change request payload from the traveller. No freeform text.
    const changeIn = body?.change_request as
      | { new_pickup_at?: string; new_flight_number?: string; new_pickup_address?: string }
      | undefined;
    const cleanChange = changeIn
      ? {
          ...(changeIn.new_pickup_at ? { new_pickup_at: String(changeIn.new_pickup_at).slice(0, 40) } : {}),
          ...(changeIn.new_flight_number ? { new_flight_number: String(changeIn.new_flight_number).trim().slice(0, 40) } : {}),
          ...(changeIn.new_pickup_address ? { new_pickup_address: String(changeIn.new_pickup_address).trim().slice(0, 200) } : {}),
        }
      : null;

    // Optional quote fields — writable by the assigned assistant only, and
    // frozen once the task has reached a confirmed/completed terminal price.
    const priceCentsIn = body?.price_cents;
    const currencyIn = body?.currency;
    const hasPriceUpdate =
      typeof priceCentsIn === "number" &&
      Number.isFinite(priceCentsIn) &&
      Number.isInteger(priceCentsIn) &&
      priceCentsIn >= 0 &&
      priceCentsIn < 1_000_000_000 &&
      typeof currencyIn === "string" &&
      /^[A-Z]{3}$/.test(currencyIn);

    if (!taskId) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: task } = await admin
      .from("concierge_tasks")
      .select("id,user_id,assistant_id,status,previous_status,category,price_cents,currency,charge_amount_cents,charge_currency,stripe_session_id,stripe_payment_intent_id,paid_at,authorized_at,capture_method,hold_released_at,summary,stripe_refund_id,details_json,booking_reference,stripe_env,entitlement_id")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const isUser = task.user_id === auth.userId;
    const isAssistant = task.assistant_id === auth.userId;

    // Owner path is unchanged: cancel only.
    // Assistant path: any of the allowed transitions, or a revert from change_pending.
    if (!isAssistant && !(isUser && requestedStatus === "cancelled")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Terminal states cannot transition further.
    if (TERMINAL.has(task.status) && !(isUser && task.status === "cancelled")) {
      return new Response(JSON.stringify({ error: "Task is already in a terminal state" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nextStatus: string;
    const patch: Record<string, unknown> = {};

    // Customer cancellation policy for transfers: free cancellation only
    // until 24 hours before pickup, and only once the transfer is CONFIRMED.
    // Unconfirmed transfers (pay_to_confirm — unpaid, authorised or charged)
    // stay cancellable at any time, as today. Ops actions are unaffected.
    // A malformed / missing pickup_at never strands the customer: we log and
    // allow the cancellation.
    if (isUser && !isAssistant && requestedStatus === "cancelled" && task.category === "transfer" && task.status === "confirmed") {
      const dj = (task as { details_json?: Record<string, unknown> | null }).details_json ?? null;
      const rawPickup = dj && typeof dj === "object" ? (dj as { pickup_at?: unknown }).pickup_at : null;
      const pickupMs = typeof rawPickup === "string" ? Date.parse(rawPickup) : NaN;
      if (!Number.isFinite(pickupMs)) {
        console.warn(
          `concierge-update-task: task ${taskId} has malformed pickup_at (${String(rawPickup)}) — allowing cancellation.`,
        );
      } else if (Date.now() >= pickupMs - 24 * 60 * 60 * 1000) {
        return new Response(
          JSON.stringify({
            code: "cancellation_window_closed",
            message:
              "Free cancellation closed 24 hours before pickup. Message the concierge and we'll see what we can do.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (revert) {
      if (!isAssistant) {
        return new Response(JSON.stringify({ error: "Only the assigned assistant can revert" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (task.status !== "change_pending" || !task.previous_status) {
        return new Response(JSON.stringify({ error: "Nothing to revert" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      nextStatus = task.previous_status as string;
      patch.status = nextStatus;
      patch.previous_status = null;
      // Apply/decline the pending structured change stored in details_json.
      const dj = (task as { details_json?: Record<string, unknown> | null }).details_json ?? null;
      const pending = (dj && typeof dj === "object" ? (dj as { pending_change?: Record<string, string> }).pending_change : null) ?? null;
      if (applyChange && pending && dj) {
        const merged: Record<string, unknown> = { ...(dj as Record<string, unknown>) };
        if (pending.new_pickup_at) merged.pickup_at = pending.new_pickup_at;
        if (pending.new_flight_number) merged.flight_number = pending.new_flight_number;
        if (pending.new_pickup_address) {
          merged.pickup_address = pending.new_pickup_address;
          merged.pickup_address_full = pending.new_pickup_address;
        }
        delete (merged as { pending_change?: unknown }).pending_change;
        patch.details_json = merged;
      } else if (cantAccommodate && dj) {
        const merged: Record<string, unknown> = { ...(dj as Record<string, unknown>) };
        delete (merged as { pending_change?: unknown }).pending_change;
        patch.details_json = merged;
      }
    } else {
      const allowed = isAssistant ? ASSISTANT_ALLOWED : OWNER_ALLOWED;
      if (!allowed.has(requestedStatus)) {
        return new Response(JSON.stringify({ error: "Invalid status transition" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      nextStatus = requestedStatus;
      patch.status = nextStatus;

      if (nextStatus === "confirmed") {
        if (!bookingReference) {
          return new Response(
            JSON.stringify({ error: "booking_reference required to confirm" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        patch.booking_reference = bookingReference;
        patch.completed_at = new Date().toISOString();
        // Merge driver dispatch details onto the transfer's details_json so
        // the traveller card and any downstream flows can render them.
        if (task.category === "transfer") {
          if (!cleanDriver || !cleanDriver.name || !cleanDriver.vehicle || !cleanDriver.plate || !cleanDriver.meeting_point) {
            return new Response(
              JSON.stringify({ error: "driver name, vehicle, plate and meeting point required" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const dj = (task as { details_json?: Record<string, unknown> | null }).details_json ?? {};
          patch.details_json = { ...(dj as Record<string, unknown>), driver: cleanDriver };
        }
      }
      if (nextStatus === "completed") {
        patch.completed_at = new Date().toISOString();
      }
      if (nextStatus === "change_pending") {
        // Snapshot the pre-change status so we can revert cleanly.
        patch.previous_status = task.status;
        if (isUser && task.category === "transfer") {
          if (!cleanChange || Object.keys(cleanChange).length === 0) {
            return new Response(
              JSON.stringify({ error: "change_request required" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const dj = (task as { details_json?: Record<string, unknown> | null }).details_json ?? {};
          patch.details_json = {
            ...(dj as Record<string, unknown>),
            pending_change: { ...cleanChange, requested_at: new Date().toISOString() },
          };
        }
      }
    }

    // Manual-capture confirm path: capture the authorised PaymentIntent
    // BEFORE the status flip commits. Failure blocks the confirm and
    // clears the authorisation so a fresh session can be created.
    let capturedCents: number | null = null;
    const t = task as Record<string, unknown>;
    if (
      nextStatus === "confirmed" &&
      task.category !== "restaurant_reservation" &&
      t.capture_method === "manual" &&
      t.authorized_at &&
      !t.paid_at &&
      typeof t.stripe_payment_intent_id === "string"
    ) {
      // Never attempt a capture on a lapsed authorisation: Stripe cancels
      // uncaptured intents after ~7 days, and the hourly sweeper releases ours
      // at 6d 12h. Past that age the capture is guaranteed to fail, so fail
      // fast with a clear instruction for ops instead.
      logHoldThresholds("concierge-update-task");
      if (isAuthorisationExpired(t.authorized_at as string | null)) {
        await admin.from("concierge_messages").insert({
          task_id: taskId,
          sender: "system",
          body:
            "The card authorisation could not be captured — please re-authorise below to confirm your booking.",
        });
        return new Response(
          JSON.stringify({
            error:
              `The card authorisation has expired (older than ${holdReleaseHours()} hours) — no capture was attempted. ` +
              "The traveller has been asked to re-authorise; confirm again once they have.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const envR = resolveTaskStripeEnv(t);
      if ("response" in envR) return envR.response;
      try {
        const captured = await stripeRequest<{ id: string; amount_received?: number; amount?: number; status: string }>(
          envR.env,
          `/v1/payment_intents/${t.stripe_payment_intent_id as string}/capture`,
          { body: {} },
        );
        capturedCents = Number(captured.amount_received ?? captured.amount ?? 0) || null;
        patch.paid_at = new Date().toISOString();
        if (capturedCents) patch.amount_paid_cents = capturedCents;
      } catch (e) {
        console.error("Stripe capture failed:", e);
        // Roll back the authorisation on our side and ask the traveller
        // to re-authorise. Status stays pay_to_confirm; a new checkout
        // session will render fresh.
        await admin
          .from("concierge_tasks")
          .update({
            authorized_at: null,
            stripe_payment_intent_id: null,
            stripe_session_id: null,
          })
          .eq("id", taskId);
        await admin.from("concierge_messages").insert({
          task_id: taskId,
          sender: "system",
          body:
            "The card authorisation could not be captured — please re-authorise below to confirm your booking.",
        });
        return new Response(
          JSON.stringify({
            error: "Capture failed at the payment provider — the traveller has been asked to re-authorise.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ---- Restaurant booking fee: capture on FIRST confirmed booking ----
    // The fee is authorised on one task (the fee task) but may cover up to
    // five confirmed bookings. Whichever booking ops confirms first triggers
    // the capture of that authorisation. Reuses the same Stripe capture call
    // as transfers; the fee task's own env/PI are authoritative.
    let feeCapturedCents: number | null = null;
    // Confirm-time backstop only. The real cap lives at request time in
    // concierge-create-task (booking 6 gets a fresh authorisation). If we
    // reach here with no allowance left, something upstream has failed: block
    // the confirmation, tell ops plainly, write nothing to the traveller's
    // thread, and log for investigation.
    if (nextStatus === "confirmed" && task.category === "restaurant_reservation" && t.entitlement_id) {
      const entId = t.entitlement_id as string;
      const { data: capEnt } = await admin
        .from("booking_entitlements")
        .select("max_bookings")
        .eq("id", entId)
        .maybeSingle();
      const maxBookings = Number(capEnt?.max_bookings ?? 5);
      const { count: alreadyConfirmed } = await admin
        .from("concierge_tasks")
        .select("id", { count: "exact", head: true })
        .eq("entitlement_id", entId)
        .neq("id", taskId)
        .in("status", ["confirmed", "completed"]);
      if ((alreadyConfirmed ?? 0) >= maxBookings) {
        console.error(
          `booking_cap_reached backstop fired: task=${taskId} entitlement=${entId} confirmed=${alreadyConfirmed ?? 0} max=${maxBookings}`,
        );
        return new Response(
          JSON.stringify({
            error: `Blocked: this booking's fee entitlement has no allowance left (all ${maxBookings} confirmed bookings used). This shouldn't happen — flag for investigation.`,
            code: "booking_cap_reached",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    if (nextStatus === "confirmed" && task.category === "restaurant_reservation" && t.entitlement_id) {
      const { data: ent } = await admin
        .from("booking_entitlements")
        .select("id,status,fee_task_id,stripe_payment_intent_id,confirmed_count,max_bookings")
        .eq("id", t.entitlement_id as string)
        .maybeSingle();
      if (ent && ent.status === "authorised" && typeof ent.stripe_payment_intent_id === "string") {
        const { data: feeTask } = await admin
          .from("concierge_tasks")
          .select("id,stripe_env,paid_at")
          .eq("id", ent.fee_task_id as string)
          .maybeSingle();
        const envR = resolveTaskStripeEnv((feeTask ?? t) as Record<string, unknown>);
        if ("response" in envR) return envR.response;
        try {
          const captured = await stripeRequest<{ id: string; amount_received?: number; amount?: number }>(
            envR.env,
            `/v1/payment_intents/${ent.stripe_payment_intent_id}/capture`,
            { body: {} },
          );
          feeCapturedCents = Number(captured.amount_received ?? captured.amount ?? 0) || null;
          const nowIso = new Date().toISOString();
          await admin
            .from("booking_entitlements")
            .update({ status: "captured", captured_at: nowIso })
            .eq("id", ent.id);
          await admin
            .from("concierge_tasks")
            .update({
              paid_at: nowIso,
              ...(feeCapturedCents ? { amount_paid_cents: feeCapturedCents } : {}),
            })
            .eq("id", ent.fee_task_id as string);
        } catch (e) {
          console.error("Booking fee capture failed:", e);
          // Clear the authorisation on the fee task so the traveller can
          // re-authorise, and block the confirm — same contract as transfers.
          await admin
            .from("concierge_tasks")
            .update({
              authorized_at: null,
              stripe_payment_intent_id: null,
              stripe_session_id: null,
              status: "pay_to_confirm",
            })
            .eq("id", ent.fee_task_id as string);
          await admin
            .from("booking_entitlements")
            .update({ status: "released", released_at: new Date().toISOString() })
            .eq("id", ent.id);
          await admin.from("concierge_messages").insert({
            task_id: taskId,
            sender: "system",
            body:
              "The booking fee couldn't be taken from your card — please authorise it again to confirm this booking.",
          });
          return new Response(
            JSON.stringify({
              error: "Capture failed at the payment provider — the traveller has been asked to re-authorise.",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Refund path — marking a PAID transfer unavailable triggers a full
    // Stripe refund of the customer's payment. Ops UI confirms before
    // sending. Idempotent: skip if already refunded.
    let refundResult: { id: string; amount: number } | null = null;
    let holdReleased = false;
    if (
      nextStatus === "unavailable" &&
      task.paid_at &&
      !task.stripe_refund_id &&
      (task as { stripe_payment_intent_id?: string | null }).stripe_payment_intent_id
    ) {
      const envR = resolveTaskStripeEnv(t);
      if ("response" in envR) return envR.response;
      try {
        const refund = await stripeRequest<{ id: string; amount: number; status: string }>(
          envR.env,
          "/v1/refunds",
          {
            body: {
              payment_intent: (task as { stripe_payment_intent_id: string }).stripe_payment_intent_id,
              metadata: { task_id: task.id, reason: "ops_marked_unavailable" },
            },
          },
        );
        refundResult = { id: refund.id, amount: refund.amount };
        patch.stripe_refund_id = refund.id;
        patch.refunded_at = new Date().toISOString();
        patch.refund_amount_cents = refund.amount;
      } catch (e) {
        console.error("Stripe refund failed:", e);
        return new Response(
          JSON.stringify({
            error: "Refund failed at the payment provider — the task hasn't been changed. Try again or refund manually.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (
      (nextStatus === "unavailable" || nextStatus === "cancelled") &&
      !task.paid_at &&
      t.authorized_at &&
      !t.hold_released_at &&
      typeof t.stripe_payment_intent_id === "string"
    ) {
      // Authorised-but-uncaptured hold → cancel the PaymentIntent to
      // release the customer's card. Fires for both ops "unavailable" and
      // user/ops "cancelled" — an abandoned auth must never linger on the
      // customer's card once the task is terminal.
      const envR = resolveTaskStripeEnv(t);
      if ("response" in envR) return envR.response;
      try {
        await stripeRequest(
          envR.env,
          `/v1/payment_intents/${t.stripe_payment_intent_id as string}/cancel`,
          { body: { cancellation_reason: "abandoned" } },
        );
        patch.hold_released_at = new Date().toISOString();
        holdReleased = true;
      } catch (e) {
        // Tolerate PIs that are already in a non-cancellable end state:
        // Stripe auto-expires uncaptured holds after ~7 days (status becomes
        // `canceled` with reason `expired`) and once succeeded/canceled they
        // can't be cancelled again. Treat those as a successful release so
        // ops can still clear the task. Every other Stripe error still fails
        // loudly. Scope: cancel path only — capture and refund unchanged.
        const msg = e instanceof Error ? e.message : String(e);
        const title = ((task as { summary?: string })?.summary ?? "concierge task").slice(0, 120);
        const piId = typeof t.stripe_payment_intent_id === "string"
          ? t.stripe_payment_intent_id
          : "unknown";

        // A succeeded PaymentIntent means the payment was already captured.
        // It must not be reported as released — ops must resolve it manually.
        if (/status of succeeded/i.test(msg)) {
          try {
            sendOpsAlert({
              event: "captured_payment_on_cancel",
              subject: `Captured payment on cancel path: ${title}`,
              headline: `Captured payment on cancel path: ${title}`,
              lines: [
                { label: "Payment intent", value: piId },
                { label: "Attempted status", value: nextStatus },
              ],
              taskId,
              category: task.category,
            });
          } catch (alertErr) {
            console.warn("ops-alert dispatch (captured on cancel) failed:", alertErr);
          }
          return new Response(
            JSON.stringify({
              error: "This payment was already captured — resolve in the Stripe dashboard before closing this task",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const alreadyReleased =
          /payment_intent_unexpected_state/i.test(msg) ||
          /status of canceled/i.test(msg) ||
          /already been canceled/i.test(msg) ||
          /cannot be canceled/i.test(msg);
        if (alreadyReleased) {
          console.warn(
            "Stripe PaymentIntent cancel skipped — already in a terminal state:",
            msg,
          );
          patch.hold_released_at = new Date().toISOString();
          holdReleased = true;
        } else {
          console.error("Stripe PaymentIntent cancel failed:", e);
          return new Response(
            JSON.stringify({
              error: "Couldn't release the card hold at the payment provider — the task hasn't been changed. Try again shortly.",
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    const { data: updated, error } = await admin
      .from("concierge_tasks").update(patch).eq("id", taskId).select().single();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep the entitlement's confirmed-booking count in step. Derived from
    // the tasks themselves rather than an incrementing counter, so repeated
    // ops actions can't double-count.
    if (task.category === "restaurant_reservation" && t.entitlement_id) {
      const entId = t.entitlement_id as string;
      if (nextStatus === "confirmed" || nextStatus === "completed") {
        const { count } = await admin
          .from("concierge_tasks")
          .select("id", { count: "exact", head: true })
          .eq("entitlement_id", entId)
          .in("status", ["confirmed", "completed"]);
        await admin
          .from("booking_entitlements")
          .update({ confirmed_count: count ?? 0 })
          .eq("id", entId);
      }
      // Fee task ended with nothing ever confirmed and the hold released →
      // the traveller has paid nothing; their next request authorises again.
      if (holdReleased) {
        await admin
          .from("booking_entitlements")
          .update({ status: "released", released_at: new Date().toISOString() })
          .eq("id", entId)
          .eq("fee_task_id", taskId)
          .eq("status", "authorised");
      }
    }

    // ---- Free first booking: restore on OUR miss, pitch the pass on success --
    // The free booking is consumed at request time. If we can't get the table
    // (unavailable) or we cancel it (ops/assistant), the traveller gets their
    // free booking back. A customer-initiated cancellation does not restore it.
    let pitchTripPass = false;
    if (task.category === "restaurant_reservation") {
      const { data: owner } = await admin
        .from("profiles")
        .select("free_booking_task_id")
        .eq("user_id", task.user_id)
        .maybeSingle();
      const isFreeBooking = owner?.free_booking_task_id === taskId;
      if (isFreeBooking) {
        const ourMiss =
          nextStatus === "unavailable" || (nextStatus === "cancelled" && isAssistant && !isUser);
        if (ourMiss) {
          await admin
            .from("profiles")
            .update({ free_booking_used_at: null, free_booking_task_id: null })
            .eq("user_id", task.user_id)
            .eq("free_booking_task_id", taskId);
        } else if (nextStatus === "confirmed") {
          // Pitch the pass at the moment of success, and only if they don't
          // already hold one.
          const { data: state } = await admin
            .rpc("booking_entitlement_state", { user_uuid: task.user_id });
          const active = Array.isArray(state) ? state[0] : state;
          pitchTripPass = !active?.id;
        }
      }
    }



    let systemBody: string | null;
    if (revert) {
      if (applyChange) {
        const bits: string[] = [];
        const dj = (task as { details_json?: Record<string, unknown> | null }).details_json ?? null;
        const pending = dj && typeof dj === "object"
          ? (dj as { pending_change?: { new_pickup_at?: string; new_flight_number?: string; new_pickup_address?: string } }).pending_change
          : null;
        if (pending?.new_pickup_at) {
          try {
            const fmt = new Intl.DateTimeFormat("en-GB", {
              weekday: "short", day: "numeric", month: "short",
              hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Shanghai",
            }).format(new Date(pending.new_pickup_at));
            bits.push(`pickup now ${fmt}`);
          } catch { /* ignore */ }
        }
        if (pending?.new_flight_number) bits.push(`flight ${pending.new_flight_number}`);
        if (pending?.new_pickup_address) bits.push(`pickup at ${pending.new_pickup_address}`);
        systemBody = bits.length ? `Updated: ${bits.join(" · ")}.` : "Your change has been applied.";
      } else if (cantAccommodate) {
        systemBody = "We can't accommodate that change. If you need to adjust this booking, please cancel and rebook.";
      } else {
        systemBody = "Change confirmed.";
      }
    } else if (nextStatus === "unavailable" && refundResult) {
      systemBody =
        "We couldn't arrange a car — your payment has been refunded in full. It typically appears in 5–10 working days.";
    } else if (nextStatus === "unavailable" && holdReleased) {
      systemBody =
        "We couldn't arrange a car. The hold on your card has been released — nothing was charged.";
    } else if (nextStatus === "cancelled" && holdReleased) {
      systemBody =
        "Cancelled. The hold on your card has been released — nothing was charged.";
    } else if (nextStatus === "confirmed" && task.category === "transfer" && cleanDriver) {
      systemBody =
        `Booking confirmed · Ref ${bookingReference ?? ""} · Your driver: ${cleanDriver.name} · ${cleanDriver.vehicle} · ${cleanDriver.plate} · ${cleanDriver.meeting_point}`;
    } else if (nextStatus === "change_pending" && isUser && task.category === "transfer" && cleanChange) {
      const bits: string[] = [];
      if (cleanChange.new_pickup_at) {
        try {
          const fmt = new Intl.DateTimeFormat("en-GB", {
            weekday: "short", day: "numeric", month: "short",
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Shanghai",
          }).format(new Date(cleanChange.new_pickup_at));
          bits.push(`new pickup ${fmt}`);
        } catch { /* ignore */ }
      }
      if (cleanChange.new_flight_number) bits.push(`new flight ${cleanChange.new_flight_number}`);
      if (cleanChange.new_pickup_address) bits.push(`new pickup address ${cleanChange.new_pickup_address}`);
      systemBody = `Change requested: ${bits.join(" · ")}. We'll confirm shortly.`;
    } else if (nextStatus === "confirmed" && capturedCents) {
      const captureCurrency = String(
        (task as { charge_currency?: string | null }).charge_currency
          ?? (task as { currency?: string | null }).currency
          ?? "GBP",
      );
      systemBody = `Your card has been charged ${fmtMoney(capturedCents, captureCurrency)} — booking confirmed, Ref ${bookingReference ?? ""}.`;
    } else {
      const copyFn = SYSTEM_COPY[nextStatus];
      systemBody = copyFn ? copyFn(bookingReference) : null;
    }
    if (systemBody) {
      await admin.from("concierge_messages").insert({
        task_id: taskId,
        sender: "system",
        body: systemBody,
      });
    }
    // The pass pitch lands right after the confirmation, as its own message.
    if (pitchTripPass) {
      await admin.from("concierge_messages").insert({
        task_id: taskId,
        sender: "system",
        body: TRIP_PASS_PITCH,
      });
    }

    // Confirmation email for the free first booking, carrying the same pitch.
    // Never blocks or fails the status change.
    if (pitchTripPass) {
      try {
        const { data: userRes } = await admin.auth.admin.getUserById(task.user_id as string);
        const to = userRes?.user?.email as string | undefined;
        if (to) {
          const copy = {
            emailSubject: "Your table is confirmed — first booking on us",
            emailHeading: "Your table is confirmed",
            emailBody: TRIP_PASS_PITCH,
            pushTitle: "Your table is confirmed",
            pushBody: TRIP_PASS_PITCH,
            ctaLabel: "View booking",
            ctaPath: `/bookings/${taskId}`,
          };
          await enqueueCustomerEmail(admin, {
            to,
            subject: copy.emailSubject,
            html: notificationEmailHtml(copy, bookingReference),
            text: notificationEmailText(copy, bookingReference),
            label: "restaurant-first-booking-confirmed",
            idempotencyKey: `first-free-confirmed:${taskId}`,
          });
        }
      } catch (e) {
        console.warn("first-free confirmation email failed:", e);
      }
    }

    // Ops alerts: user cancellation, and any task entering pay_to_confirm or
    // unavailable. Assistant/ops-initiated status changes never alert (only
    // the user cancel path fires here).
    try {
      const title = ((updated as { summary?: string })?.summary ?? "concierge task").slice(0, 120);
      if (isUser && nextStatus === "cancelled") {
        sendOpsAlert({
          event: "cancelled_by_user",
          subject: `Cancelled by user: ${title}`,
          headline: `Cancelled by user: ${title}`,
          lines: [{ label: "Status", value: "cancelled" }],
          taskId,
          category: task.category,
        });
      } else if (isUser && nextStatus === "change_pending" && task.category === "transfer" && cleanChange) {
        const lines: OpsAlertLine[] = [];
        if (cleanChange.new_pickup_at) lines.push({ label: "New pickup", value: cleanChange.new_pickup_at });
        if (cleanChange.new_flight_number) lines.push({ label: "New flight", value: cleanChange.new_flight_number });
        if (cleanChange.new_pickup_address) lines.push({ label: "New pickup address", value: cleanChange.new_pickup_address });
        sendOpsAlert({
          event: "change_requested",
          subject: `Change requested: ${title}`,
          headline: `Change requested: ${title}`,
          lines,
          taskId,
          category: task.category,
        });
      } else if (isAssistant && nextStatus === "unavailable") {
        sendOpsAlert({
          event: "status_unavailable",
          subject: `Marked unavailable: ${title}${refundResult ? " · refunded" : ""}`,
          headline: `Marked unavailable: ${title}`,
          lines: [
            { label: "Status", value: "unavailable" },
            ...(refundResult ? [{ label: "Refund", value: `${refundResult.amount} minor units · ${refundResult.id}` }] : []),
          ],
          taskId,
          category: task.category,
        });
      }
    } catch (e) {
      console.warn("ops-alert dispatch (update) failed:", e);
    }

    return new Response(JSON.stringify({ task: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge-update-task error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
