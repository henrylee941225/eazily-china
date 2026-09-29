// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Hourly sweeper for transfers that are authorised but never confirmed.
//
// expire_unpaid_transfers() (SQL cron) handles the never-authorised path and is
// deliberately untouched. This function owns the authorised-but-uncaptured
// path, which SQL can't handle because releasing the hold needs a Stripe call.
//
// For transfers with status='pay_to_confirm', authorized_at set, paid_at null,
// hold_released_at null:
//   - at authorized_at + 5 days: ops alert ("hold at risk") + one customer
//     hold_expiring_soon notification event.
//   - at authorized_at + 6d 12h, or as soon as pickup_at is in the past:
//     cancel the PaymentIntent, stamp hold_released_at, move the booking to
//     'unavailable' — the existing task trigger fires booking_unavailable.
//
// Invoked by pg_cron; also callable manually. Safe to run repeatedly: the
// at-risk step dedupes on details_json.hold_at_risk_alerted_at and on the
// notification_events dedupe_key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendOpsAlert } from "../_shared/ops-alert.ts";
import { stripeRequest, type StripeEnv } from "../_shared/stripe.ts";
import { storedStripeEnv } from "../_shared/payments-env.ts";
import {
  holdAgeHours,
  logHoldThresholds,
  hoursUntilRelease,
} from "../_shared/holdExpiry.ts";

type Task = {
  id: string;
  user_id: string;
  authorized_at: string | null;
  booking_reference: string | null;
  summary: string | null;
  city: string | null;
  stripe_payment_intent_id: string | null;
  stripe_env: string | null;
  charge_amount_cents: number | null;
  charge_currency: string | null;
  price_cents: number | null;
  currency: string | null;
  details_json: Record<string, unknown> | null;
};

const pickupMs = (dj: Record<string, unknown> | null): number => {
  const p = dj?.pickup_at;
  if (typeof p !== "string") return NaN;
  const ms = Date.parse(p);
  return Number.isFinite(ms) ? ms : NaN;
};

// A hold is released in the mode it was authorised in — never a guess. Rows
// with no recorded mode are left for a human; the DB constraint means only
// pre-cutover data can be in that state.
const resolveEnv = (t: Task): StripeEnv | null => {
  const env = storedStripeEnv(t.stripe_env);
  if (!env) {
    console.error(
      `expire-authorised-holds: task ${t.id} has no stripe_env — skipping (resolve manually in Stripe)`,
    );
    return null;
  }
  return env;
};

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await admin
    .from("concierge_tasks")
    .select(
      "id,user_id,authorized_at,booking_reference,summary,city,stripe_payment_intent_id,stripe_env,charge_amount_cents,charge_currency,price_cents,currency,details_json",
    )
    .eq("category", "transfer")
    .eq("status", "pay_to_confirm")
    .not("authorized_at", "is", null)
    .is("paid_at", null)
    .is("hold_released_at", null);

  if (error) {
    console.error("expire-authorised-holds: query failed", error);
    return new Response(JSON.stringify({ error: "query_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tasks = (data ?? []) as Task[];
  let released = 0;
  let flagged = 0;
  let skipped = 0;
  const { atRiskHours, releaseHours } = logHoldThresholds("expire-authorised-holds");

  for (const t of tasks) {
    const age = holdAgeHours(t.authorized_at);
    if (age === null) {
      skipped++;
      continue;
    }
    const pickupPast = Number.isFinite(pickupMs(t.details_json)) &&
      pickupMs(t.details_json) < Date.now();
    const nowIso = new Date().toISOString();
    const dj = t.details_json ?? {};

    // ---- Release step ----
    if (age >= releaseHours || pickupPast) {
      const env = resolveEnv(t);
      if (!env) {
        skipped++;
        continue;
      }

      if (t.stripe_payment_intent_id) {
        try {
          const pi = await stripeRequest<{ id: string; status: string }>(
            env,
            `/v1/payment_intents/${t.stripe_payment_intent_id}/cancel`,
            { body: {} },
          );
          // A succeeded intent means the money was already taken. Do NOT mark
          // the booking unavailable over a real charge — alert ops instead.
          if (pi.status === "succeeded") {
            console.error("expire-authorised-holds: PI already captured", { task: t.id, pi: pi.id });
            await sendOpsAlert({
              event: "captured_payment_on_hold_expiry",
              subject: `Action needed — captured payment on an unconfirmed transfer ${t.booking_reference ?? t.id.slice(0, 8)}`,
              headline: "Payment already captured on an unconfirmed transfer",
              intro:
                "The hold sweeper tried to release this authorisation and Stripe reported the payment as already captured. Resolve in Stripe before closing this task.",
              lines: [
                { label: "Task", value: t.id },
                { label: "Payment intent", value: pi.id },
                { label: "Hold age", value: `${Math.round(age)}h` },
              ],
              taskId: t.id,
              category: "transfer",
            });
            skipped++;
            continue;
          }
        } catch (e) {
          // Stripe may already have cancelled/expired it. Either way our own
          // state must move on, so log and continue to the DB update.
          console.warn("expire-authorised-holds: cancel failed", { task: t.id, e: String(e) });
        }
      }

      const { error: upError } = await admin
        .from("concierge_tasks")
        .update({
          status: "unavailable",
          hold_released_at: nowIso,
          details_json: { ...dj, hold_released_reason: pickupPast ? "pickup_passed" : "hold_expiry" },
        })
        .eq("id", t.id);

      if (upError) {
        console.error("expire-authorised-holds: update failed", { task: t.id, upError });
        skipped++;
        continue;
      }

      await admin.from("concierge_messages").insert({
        task_id: t.id,
        sender: "system",
        body:
          "We couldn't confirm a driver in time, so the hold on your card has been released — nothing was charged. You can request another transfer any time.",
      });

      await sendOpsAlert({
        event: "hold_released_unconfirmed",
        subject: `Hold released — no driver confirmed ${t.booking_reference ?? t.id.slice(0, 8)}`,
        headline: "Authorisation released, booking marked unavailable",
        intro: pickupPast
          ? "The pickup time passed with no driver confirmed."
          : `The authorisation reached ${releaseHours} hours with no driver confirmed.`,
        lines: [
          { label: "Task", value: t.id },
          { label: "Authorised", value: String(t.authorized_at) },
          { label: "Hold age", value: `${Math.round(age)}h` },
          { label: "Pickup", value: String(dj.pickup_at ?? "unknown") },
        ],
        taskId: t.id,
        category: "transfer",
      });

      released++;
      continue;
    }

    // ---- At-risk step ----
    if (age >= atRiskHours && !dj.hold_at_risk_alerted_at) {
      const remaining = hoursUntilRelease(t.authorized_at);

      await sendOpsAlert({
        event: "hold_at_risk",
        subject: `At risk — card hold expires in ~${remaining}h, no driver yet (${t.booking_reference ?? t.id.slice(0, 8)})`,
        headline: "Card hold at risk of expiry",
        intro:
          "This transfer is still unconfirmed. If no driver is confirmed we release the hold automatically and the booking is marked unavailable.",
        lines: [
          { label: "Task", value: t.id },
          { label: "Summary", value: t.summary ?? "" },
          { label: "City", value: t.city ?? "" },
          { label: "Authorised", value: String(t.authorized_at) },
          { label: "Hours remaining", value: `${remaining}h` },
          { label: "Pickup", value: String(dj.pickup_at ?? "unknown") },
        ],
        taskId: t.id,
        category: "transfer",
      });

      // Customer heads-up. Dedupe key is one-shot per task.
      await admin.from("notification_events").insert({
        task_id: t.id,
        user_id: t.user_id,
        event_key: "hold_expiring_soon",
        from_status: "pay_to_confirm",
        to_status: "pay_to_confirm",
        dedupe_key: `${t.id}:hold_expiring_soon`,
        payload: {
          category: "transfer",
          summary: t.summary,
          city: t.city,
          booking_reference: t.booking_reference,
          amount_cents: t.charge_amount_cents ?? t.price_cents,
          currency: t.charge_currency ?? t.currency,
          authorized_at: t.authorized_at,
          hours_remaining: remaining,
          pickup_at: dj.pickup_at ?? null,
        },
      });

      await admin
        .from("concierge_tasks")
        .update({ details_json: { ...dj, hold_at_risk_alerted_at: nowIso } })
        .eq("id", t.id);

      flagged++;
      continue;
    }

    skipped++;
  }

  return new Response(
    JSON.stringify({ scanned: tasks.length, released, flagged, skipped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}));
