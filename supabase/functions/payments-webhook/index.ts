// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// HMAC-SHA256 signature verification for Stripe webhooks.
// Stripe-Signature header format: "t=<timestamp>,v1=<sig>,v1=<sig>..."
const verifySignature = async (
  payload: string,
  header: string | null,
  secret: string,
  toleranceSec = 300
): Promise<boolean> => {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    })
  ) as Record<string, string>;
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
};

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Each Stripe endpoint carries its own mode in the URL and is verified
    // against that mode's own signing secret. An unrecognised value is
    // rejected rather than quietly treated as sandbox — a live event checked
    // with the test secret (or the reverse) must never be accepted.
    const url = new URL(req.url);
    const rawEnv = url.searchParams.get("env");
    if (rawEnv !== "live" && rawEnv !== "sandbox") {
      console.error(`payments-webhook: missing or invalid env parameter '${rawEnv}'`);
      return json(400, { error: "Invalid webhook environment" });
    }
    const env: StripeEnv = rawEnv;

    const secretName =
      env === "live" ? "PAYMENTS_LIVE_WEBHOOK_SECRET" : "PAYMENTS_SANDBOX_WEBHOOK_SECRET";
    const webhookSecret = Deno.env.get(secretName);
    if (!webhookSecret) {
      console.error(`${secretName} is not configured`);
      return json(500, { error: "Webhook secret not configured" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { error: "Backend not configured" });

    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");
    const ok = await verifySignature(payload, signature, webhookSecret);
    if (!ok) {
      console.warn("Invalid webhook signature");
      return json(401, { error: "Invalid signature" });
    }

    const event = JSON.parse(payload) as {
      id: string;
      type: string;
      livemode?: boolean;
      data: { object: Record<string, unknown> };
    };

    // Belt and braces: the event's own livemode flag must agree with the
    // endpoint it arrived on, so a real payment can never be processed as
    // test money (or the reverse) even if the endpoints were misconfigured.
    const eventIsLive = event.livemode === true;
    if (eventIsLive !== (env === "live")) {
      console.error(
        `payments-webhook: event ${event.id} livemode=${event.livemode} arrived on env='${env}' — rejecting`,
      );
      return json(400, { error: "Event environment mismatch" });
    }
    console.log(`payments-webhook: handling ${event.type} (${event.id}) in mode '${env}'`);


    const admin = createClient(supabaseUrl, serviceKey);
    const obj = event.data.object;
    const metadata = (obj["metadata"] as Record<string, string> | undefined) ?? {};
    const eventType = event.type;

    // ---------- 1) Subscription lifecycle ----------
    // The Annual Pass product has been removed; the app sells only the
    // Trip Pass. Subscription events are acknowledged and ignored — nothing
    // is written to `subscriptions` or `profiles.annual_active_until`.
    if (eventType.startsWith("customer.subscription.")) {
      return json(200, { ignored: eventType });
    }

    // ---------- 2) Checkout session completion (passes + wallet) ----------
    // On checkout.session.* events, `obj.id` is the session id and
    // `obj.payment_intent` is the PI. On payment_intent.* events, `obj.id`
    // is the PI id and there is no session id on the event.
    const isPaymentIntentEvent = eventType.startsWith("payment_intent.");
    const sessionId = isPaymentIntentEvent
      ? (obj["session_id"] as string | undefined)
      : ((obj["id"] as string | undefined) || (obj["session_id"] as string | undefined));
    const paymentIntentId = isPaymentIntentEvent
      ? (obj["id"] as string | undefined)
      : ((obj["payment_intent"] as string | undefined) ||
         (obj["payment_intent_id"] as string | undefined));

    let succeeded = false;
    let failed = false;

    if (eventType === "checkout.session.completed" || eventType === "transaction.completed") {
      // Manual-capture Checkout Sessions fire `checkout.session.completed`
      // on AUTHORIZATION with `payment_status = "unpaid"` and
      // `status = "complete"`. Treat that as success so the downstream
      // concierge-task branch can flip authorized_at. The branch itself
      // distinguishes manual vs automatic capture and writes the correct
      // marker.
      const paymentStatus = (obj["payment_status"] as string | undefined) ?? "paid";
      const sessionStatus = (obj["status"] as string | undefined) ?? "";
      const capMethod = (metadata.capture_method as string | undefined) ?? "";
      if (
        eventType === "transaction.completed" ||
        paymentStatus === "paid" ||
        paymentStatus === "complete" ||
        paymentStatus === "succeeded" ||
        (sessionStatus === "complete" &&
          (paymentStatus === "no_payment_required" || capMethod === "manual"))
      ) {
        succeeded = true;
      }
    } else if (eventType === "payment_intent.amount_capturable_updated") {
      // Secondary authorization signal for manual capture. Idempotent with
      // the checkout.session.completed path — whichever arrives first sets
      // authorized_at; the concierge-task branch early-returns on the second.
      succeeded = true;
    } else if (
      eventType === "checkout.session.async_payment_failed" ||
      eventType === "transaction.payment_failed" ||
      eventType === "payment_intent.payment_failed"
    ) {
      failed = true;
    } else {
      return json(200, { ignored: eventType });
    }

    // Trip Pass checkout completion → set entitlements.
    const purchaseType = metadata.type;
    const product = metadata.product;
    const userId = metadata.user_id;

    if (succeeded && userId && purchaseType === "pass") {
      if (product === "trip_pass") {
        // Validity is anchored to TRIP dates, never purchase date. Prefer the
        // trip_passes row (source of truth) then metadata then profile as
        // fallbacks. Cap end at start + 60 days. The 48h grace in
        // has_ai_access covers late departures.
        const tripPassId = metadata.trip_pass_id;
        let startIso: string | null = (metadata.trip_start_date as string | undefined) ?? null;
        let endIso: string | null = (metadata.trip_end_date as string | undefined) ?? null;
        if (tripPassId) {
          const { data: row } = await admin
            .from("trip_passes")
            .select("trip_start_date, trip_end_date")
            .eq("id", tripPassId)
            .maybeSingle();
          startIso = (row?.trip_start_date as string | undefined) ?? startIso;
          endIso = (row?.trip_end_date as string | undefined) ?? endIso;
        }
        if (!endIso) {
          const { data: profile } = await admin
            .from("profiles")
            .select("arrival_date, departure_date")
            .eq("user_id", userId)
            .maybeSingle();
          startIso = startIso ?? ((profile?.arrival_date as string | undefined) ?? null);
          endIso = (profile?.departure_date as string | undefined) ?? null;
        }
        let until: Date;
        if (endIso) {
          until = new Date(`${endIso}T23:59:59Z`);
          if (startIso) {
            const startMs = new Date(`${startIso}T00:00:00Z`).getTime();
            const capMs = startMs + 60 * 24 * 60 * 60 * 1000;
            if (until.getTime() > capMs) until = new Date(capMs);
          }
          if (until.getTime() < Date.now()) {
            until = new Date(Date.now() + 24 * 60 * 60 * 1000);
          }
        } else {
          until = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        // The 48h grace period is applied at READ time in has_ai_access.
        await admin
          .from("profiles")
          .update({ trip_pass_active_until: until.toISOString() })
          .eq("user_id", userId);

        // Mark the trip_passes row as active.
        if (tripPassId) {
          await admin
            .from("trip_passes")
            .update({
              status: "active",
              stripe_payment_id: paymentIntentId ?? null,
            })
            .eq("id", tripPassId);
        } else if (sessionId) {
          await admin
            .from("trip_passes")
            .update({
              status: "active",
              stripe_payment_id: paymentIntentId ?? null,
            })
            .eq("stripe_session_id", sessionId);
        }
      }
      return json(200, { received: true, kind: "pass", product });
    }

    // ---------- 2b) Concierge task payment ----------
    if (
      (succeeded || failed) &&
      (purchaseType === "concierge_task" || product === "concierge_task")
    ) {
      let taskId = metadata.task_id as string | undefined;
      // Fallback for PI events whose metadata wasn't populated at booking
      // time — resolve the task by stripe_payment_intent_id, then session id.
      if (!taskId && (paymentIntentId || sessionId)) {
        const lookup = paymentIntentId
          ? await admin
              .from("concierge_tasks")
              .select("id")
              .eq("stripe_payment_intent_id", paymentIntentId)
              .maybeSingle()
          : await admin
              .from("concierge_tasks")
              .select("id")
              .eq("stripe_session_id", sessionId!)
              .maybeSingle();
        taskId = (lookup.data?.id as string | undefined) ?? undefined;
      }
      if (!taskId) return json(200, { ignored: "concierge_task without task_id" });

      if (failed) {
        // Leave status at pay_to_confirm so the traveller can retry.
        await admin.from("concierge_messages").insert({
          task_id: taskId,
          sender: "system",
          body: "Payment attempt failed. Tap the payment button again to retry.",
        });
        return json(200, { received: true, kind: "concierge_task", status: "failed" });
      }

      const { data: taskRow } = await admin
        .from("concierge_tasks")
        .select("id,status,paid_at,authorized_at,capture_method,price_cents,currency,charge_amount_cents,charge_currency,quoted_gbp_cents,quoted_cny_cents,booking_reference,summary,category")
        .eq("id", taskId)
        .maybeSingle();
      if (!taskRow) return json(200, { ignored: "task not found" });
      if (taskRow.paid_at || taskRow.authorized_at) {
        return json(200, { received: true, kind: "concierge_task", already: true });
      }

      // Late-payment guard: the task must still be awaiting payment.
      // If it expired (cancelled by expire_unpaid_transfers) or was
      // cancelled by the traveller while a checkout session was open,
      // do NOT flip authorized_at/paid_at or change status. Post a
      // system message and fire an ops alert — the assistant resolves
      // the stray charge/authorisation manually.
      if (taskRow.status !== "pay_to_confirm") {
        await admin.from("concierge_messages").insert({
          task_id: taskId,
          sender: "system",
          body:
            "A payment came in after this request expired. It won't confirm the booking — the assistant will contact you to resolve it.",
        });
        try {
          const title = (taskRow.summary ?? "concierge task").slice(0, 120);
          const { sendOpsAlert } = await import("../_shared/ops-alert.ts");
          sendOpsAlert({
            event: "payment_after_expiry",
            subject: `Payment after expiry: ${title}`,
            headline: `Payment after expiry: ${title}`,
            intro: `A payment webhook arrived for a task that is no longer awaiting payment (status: ${taskRow.status}). Reconcile the Stripe charge or authorisation manually.`,
            lines: [
              { label: "Task", value: title },
              { label: "Current status", value: String(taskRow.status) },
              { label: "Capture method", value: String(taskRow.capture_method ?? "automatic") },
              { label: "Payment intent", value: paymentIntentId ?? "" },
              { label: "Session", value: sessionId ?? "" },
            ],
            taskId,
            category: taskRow.category,
          });
        } catch (e) {
          console.warn("payment-after-expiry ops alert failed:", e);
        }
        return json(200, { received: true, kind: "concierge_task", status: "late" });
      }

      // Stale-session guard: compare the CHARGE fields the customer paid
      // against the currently locked charge fields. If ops re-quoted after
      // this session was created, they won't match — do NOT mark paid.
      // Falls back to legacy price_cents comparison for pre-multi-currency
      // sessions.
      const metaChargeCents = Number(metadata.charge_amount_cents || metadata.price_cents || 0);
      const metaChargeCurrency = String(
        metadata.charge_currency || metadata.currency || "",
      ).toUpperCase();
      const currentChargeCents = Number(
        taskRow.charge_amount_cents || taskRow.price_cents || 0,
      );
      const currentChargeCurrency = String(
        taskRow.charge_currency || taskRow.currency || "",
      ).toUpperCase();
      const stale =
        metaChargeCents && currentChargeCents &&
        (metaChargeCents !== currentChargeCents ||
          (metaChargeCurrency && currentChargeCurrency && metaChargeCurrency !== currentChargeCurrency));
      if (stale) {
        await admin.from("concierge_messages").insert({
          task_id: taskId,
          sender: "system",
          body:
            "A payment came in against an outdated quote. It won't confirm the booking — the assistant will contact you to refund or reconcile.",
        });
        try {
          const title = (taskRow.summary ?? "concierge task").slice(0, 120);
          const { sendOpsAlert } = await import("../_shared/ops-alert.ts");
          sendOpsAlert({
            event: "stale_payment",
            subject: `Stale payment received: ${title}`,
            headline: `Stale payment received: ${title}`,
            intro: `Session ${metaChargeCents} ${metaChargeCurrency} ≠ current ${currentChargeCents} ${currentChargeCurrency}.`,
            lines: [
              { label: "Task", value: title },
              { label: "Paid", value: `${metaChargeCents} ${metaChargeCurrency}` },
              { label: "Current", value: `${currentChargeCents} ${currentChargeCurrency}` },
              { label: "Payment intent", value: paymentIntentId ?? "" },
            ],
            taskId,
            category: taskRow.category,
          });
        } catch (e) {
          console.warn("stale-payment ops alert failed:", e);
        }
        return json(200, { received: true, kind: "concierge_task", status: "stale" });
      }

      const paidCents = metaChargeCents || currentChargeCents;
      const paidCurrency = metaChargeCurrency || currentChargeCurrency;

      // Manual capture = authorise now, charge only when a driver is
      // confirmed. Automatic capture = money already moved at Stripe.
      // Prefer the task's persisted capture_method, fall back to session
      // metadata for older sessions.
      const captureMethod =
        (taskRow.capture_method as string | null) ??
        (metadata.capture_method as string | undefined) ??
        "automatic";
      const isManual = captureMethod === "manual";

      const updatePayload: Record<string, unknown> = {
        stripe_payment_intent_id: paymentIntentId ?? null,
        stripe_session_id: sessionId ?? null,
      };
      if (isManual) {
        updatePayload.authorized_at = new Date().toISOString();
      } else {
        updatePayload.amount_paid_cents = paidCents || null;
        updatePayload.paid_at = new Date().toISOString();
      }
      // Restaurant booking fee: the authorisation starts the entitlement,
      // so the request itself joins the normal ops queue (`pending`) and
      // the traveller can queue further bookings immediately. Transfers
      // keep status at pay_to_confirm — `authorized_at`/`paid_at` are the
      // queue signal there.
      const isBookingFee =
        taskRow.category === "restaurant_reservation" && isManual;
      if (isBookingFee) updatePayload.status = "pending";
      await admin.from("concierge_tasks").update(updatePayload).eq("id", taskId);

      if (isBookingFee) {
        // Create the entitlement (idempotent on fee_task_id) covering up to
        // 5 confirmed bookings for the trip. Capture happens later, when
        // ops confirms the first booking.
        const { data: taskOwner } = await admin
          .from("concierge_tasks")
          .select("user_id")
          .eq("id", taskId)
          .maybeSingle();
        const ownerId = taskOwner?.user_id as string | undefined;
        if (ownerId) {
          const { data: prof } = await admin
            .from("profiles")
            .select("arrival_date, departure_date")
            .eq("user_id", ownerId)
            .maybeSingle();
          // Deterministic validity: never null. No trip dates → today + 60d,
          // flagged so the app prompts for dates (a DB trigger realigns).
          const DAY = 24 * 60 * 60 * 1000;
          const today = new Date().toISOString().slice(0, 10);
          const arrival = (prof?.arrival_date as string | null) ?? null;
          const departure = (prof?.departure_date as string | null) ?? null;
          const validFrom = arrival ?? today;
          const cap = new Date(new Date(`${validFrom}T00:00:00Z`).getTime() + 60 * DAY)
            .toISOString().slice(0, 10);
          const tripDatesDefaulted = !departure || departure < today;
          const validUntil = tripDatesDefaulted
            ? new Date(new Date(`${today}T00:00:00Z`).getTime() + 60 * DAY).toISOString().slice(0, 10)
            : (departure! < cap ? departure! : cap);
          const { error: entErr } = await admin
            .from("booking_entitlements")
            .upsert(
              {
                user_id: ownerId,
                fee_task_id: taskId,
                source: "stripe",
                stripe_payment_intent_id: paymentIntentId ?? null,
                status: "authorised",
                max_bookings: 5, // explicit: never rely on the column default
                valid_from: tripDatesDefaulted ? today : validFrom,
                valid_until: validUntil,
                trip_dates_defaulted: tripDatesDefaulted,
              },
              { onConflict: "fee_task_id" },
            );
          if (entErr) console.error("booking entitlement upsert failed:", entErr);
          const { data: ent } = await admin
            .from("booking_entitlements")
            .select("id")
            .eq("fee_task_id", taskId)
            .maybeSingle();
          if (ent?.id) {
            await admin
              .from("concierge_tasks")
              .update({ entitlement_id: ent.id })
              .eq("id", taskId);
          }
        }
      }

      await admin.from("concierge_messages").insert({
        task_id: taskId,
        sender: "system",
        body: isBookingFee
          ? "Booking fee authorised — a person is confirming your table now. You'll only be charged once your first booking is confirmed, and you can send more booking requests straight away."
          : isManual
            ? "Payment authorised — confirming your driver. Your card is on hold, not charged; you'll only be charged once your driver is confirmed."
            : "Payment received — confirming your driver. Charged now because your trip is further out, and refunded in full if we can't confirm a car.",
      });

      // Ops alert — a person must now confirm the booking upstream. For
      // paid transfers, use the rich driver-dispatch template with the
      // structured payload derived from details_json.
      try {
        const title = (taskRow.summary ?? "concierge task").slice(0, 120);
        const { sendOpsAlert } = await import("../_shared/ops-alert.ts");

        const { data: fullTask } = await admin
          .from("concierge_tasks")
          .select("id,category,details_json,user_id")
          .eq("id", taskId)
          .maybeSingle();
        const isTransfer = fullTask?.category === "transfer";

        // Format the paid amount using the same GBP/major-unit rules as
        // the client. Kept inline to avoid re-exporting from src/.
        const CURRENCY_SYMBOL: Record<string, string> = {
          CNY: "¥", USD: "$", EUR: "€", GBP: "£", HKD: "HK$", JPY: "¥",
        };
        const ZERO_DECIMAL = new Set(["JPY", "KRW", "IDR"]);
        const fmtPaid = (cents: number, currency: string): string => {
          const cur = (currency || "GBP").toUpperCase();
          const symbol = CURRENCY_SYMBOL[cur] ?? `${cur} `;
          const value = ZERO_DECIMAL.has(cur) ? Math.round(cents) : cents / 100;
          return `${symbol}${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
        };
        const paidLabel = paidCents ? fmtPaid(paidCents, paidCurrency) : "";

        if (isTransfer && fullTask?.details_json && typeof fullTask.details_json === "object") {
          const { buildTransferAlertData } = await import("../_shared/build-transfer-alert.ts");
          const { data: profile } = await admin
            .from("profiles")
            .select("display_name, phone")
            .eq("user_id", fullTask.user_id)
            .maybeSingle();
          const passenger = profile?.display_name ?? "Traveller";
          const transferPayload = buildTransferAlertData({
            taskId,
            detailsJson: fullTask.details_json as Record<string, unknown>,
            passenger,
            fallbackPhone: profile?.phone ?? null,
          });
          const stateWord = isManual ? "AUTHORISED" : "PAID";
          sendOpsAlert({
            event: isManual ? "authorised_transfer_secure_driver" : "paid_transfer_secure_driver",
            subject: `New ${stateWord} transfer — secure a driver · ${paidLabel}`,
            headline: `New ${stateWord} transfer — secure a driver`,
            intro: isManual
              ? `Traveller has authorised ${paidLabel} — capture on confirm. Confirm a driver and post the booking reference.`
              : `Traveller has paid ${paidLabel}. Confirm a driver and post the booking reference.`,
            lines: [
              { label: isManual ? "Authorised" : "Paid", value: paidLabel },
              { label: "GBP quoted", value: taskRow.quoted_gbp_cents ? fmtPaid(Number(taskRow.quoted_gbp_cents), "GBP") : "" },
            ],
            taskId,
            category: fullTask?.category,
            transfer: transferPayload ?? undefined,
          });
        } else {
          sendOpsAlert({
            event: "paid_awaiting_confirmation",
            subject: `Action needed: ${isManual ? "authorised" : "paid"} — confirm booking: ${title}`,
            headline: `Action needed: ${isManual ? "authorised" : "paid"} — confirm booking: ${title}`,
            lines: [
              { label: "Task", value: title },
              { label: isManual ? "Authorised" : "Amount", value: paidLabel || `${paidCents} ${paidCurrency}` },
            ],
            taskId,
            category: fullTask?.category,
          });
        }
      } catch (e) {
        console.warn("paid ops alert failed:", e);
      }

      return json(200, { received: true, kind: "concierge_task", status: isManual ? "authorised" : "paid" });
    }

    return json(200, { ignored: "unhandled event or session kind" });
  } catch (err) {
    console.error("payments-webhook error:", err);
    return json(500, { error: "Internal server error" });
  }
}));
