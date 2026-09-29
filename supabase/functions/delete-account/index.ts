// Customer-initiated account deletion (Apple App Store requirement, and the
// UK/EU right to erasure).
//
// Order of operations matters and is deliberate:
//   1. Refuse outright while a booking is live or money is held on a card.
//   2. Cancel any uncaptured PaymentIntent that is still hanging around.
//   3. Skip queued notification deliveries so nothing emails a deleted person.
//   4. Alert ops so they stop working any open task.
//   5. Clear personal data via `delete_user_data` (the single cleanup place),
//      which first copies money-only records into retained_transaction_records.
//   6. Delete the auth user itself.
//
// GET  -> eligibility check (what, if anything, is blocking deletion)
// POST -> perform deletion (requires { confirm: "DELETE" })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { sendOpsAlert } from "../_shared/ops-alert.ts";
import { stripeRequest } from "../_shared/stripe.ts";
import { storedStripeEnv } from "../_shared/payments-env.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Anything not in this list is still being worked on by someone.
const TERMINAL_STATUSES = new Set(["completed", "cancelled", "unavailable"]);

type TaskRow = {
  id: string;
  category: string;
  status: string;
  summary: string;
  authorized_at: string | null;
  paid_at: string | null;
  hold_released_at: string | null;
  refunded_at: string | null;
  stripe_payment_intent_id: string | null;
  stripe_env: string | null;
  charge_amount_cents: number | null;
  charge_currency: string | null;
  price_cents: number | null;
  currency: string | null;
};

type Blocker = { taskId: string; label: string; reason: string };

/** Money is still sitting on the customer's card for this task. */
const moneyHeld = (t: TaskRow) =>
  !!t.authorized_at && !t.hold_released_at && !t.refunded_at && !t.paid_at;

/** Payment taken and not refunded — the service is still owed. */
const moneyTaken = (t: TaskRow) => !!t.paid_at && !t.refunded_at;

const describe = (t: TaskRow) => {
  const kind = t.category === "transfer" ? "Car transfer" : "Restaurant booking";
  return `${kind} — ${t.summary}`;
};

function blockersFor(tasks: TaskRow[]): Blocker[] {
  const out: Blocker[] = [];
  for (const t of tasks) {
    const live = !TERMINAL_STATUSES.has(t.status);
    if (moneyHeld(t)) {
      out.push({
        taskId: t.id,
        label: describe(t),
        reason: "Your card still has a hold on it for this booking.",
      });
    } else if (live && moneyTaken(t)) {
      out.push({
        taskId: t.id,
        label: describe(t),
        reason: "This booking is paid for and still going ahead.",
      });
    } else if (live) {
      out.push({
        taskId: t.id,
        label: describe(t),
        reason:
          t.status === "confirmed"
            ? "This booking is confirmed and still to happen."
            : "We're still working on this request.",
      });
    }
  }
  return out;
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const userId = auth.userId;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Server misconfigured" }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: taskRows, error: tasksErr } = await admin
    .from("concierge_tasks")
    .select(
      "id, category, status, summary, authorized_at, paid_at, hold_released_at, refunded_at, stripe_payment_intent_id, stripe_env, charge_amount_cents, charge_currency, price_cents, currency",
    )
    .eq("user_id", userId);

  if (tasksErr) {
    console.error("delete-account: task lookup failed", tasksErr);
    return json({ error: "Couldn't check your bookings. Please try again." }, 500);
  }

  const tasks = (taskRows ?? []) as TaskRow[];
  const blockers = blockersFor(tasks);

  if (req.method === "GET") {
    return json({ canDelete: blockers.length === 0, blockers });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // treated as missing confirmation below
  }
  if ((body.confirm ?? "").trim().toUpperCase() !== "DELETE") {
    return json({ error: "Type DELETE to confirm." }, 400);
  }

  if (blockers.length > 0) {
    return json(
      {
        code: "booking_live",
        error: "You have a booking we're still handling.",
        blockers,
      },
      409,
    );
  }

  // --- 2. Cancel any uncaptured PaymentIntent still open on this account ----
  const cancelled: string[] = [];
  const cancelFailures: string[] = [];
  const uncaptured = tasks.filter((t) => moneyHeld(t) && t.stripe_payment_intent_id);
  for (const t of uncaptured) {
    // Release in the mode the hold was taken in. No fallback: guessing here
    // would aim live credentials at a sandbox hold (or the reverse).
    const env = storedStripeEnv(t.stripe_env);
    if (!env) {
      console.error("delete-account: task has no stripe_env, cannot release hold", t.id);
      cancelFailures.push(t.stripe_payment_intent_id!);
      continue;
    }
    try {
      await stripeRequest(env, `/payment_intents/${t.stripe_payment_intent_id}/cancel`, {
        method: "POST",
      });
      cancelled.push(t.stripe_payment_intent_id!);
      await admin
        .from("concierge_tasks")
        .update({ hold_released_at: new Date().toISOString() })
        .eq("id", t.id);
    } catch (err) {
      console.error("delete-account: PaymentIntent cancel failed", t.stripe_payment_intent_id, err);
      cancelFailures.push(t.stripe_payment_intent_id!);
    }
  }
  // The booking-fee hold lives on its own row, so an authorised fee whose task
  // has already ended would otherwise leave money sitting on the card.
  const { data: heldFees } = await admin
    .from("booking_entitlements")
    .select("id, status, stripe_payment_intent_id, released_at, captured_at, fee_task_id")
    .eq("user_id", userId)
    .eq("status", "authorised")
    .is("released_at", null)
    .is("captured_at", null);
  for (const fee of heldFees ?? []) {
    if (!fee.stripe_payment_intent_id) continue;
    const feeTask = tasks.find((t) => t.id === fee.fee_task_id);
    const env = storedStripeEnv(feeTask?.stripe_env);
    if (!env) {
      console.error("delete-account: fee task has no stripe_env, cannot release hold", fee.id);
      cancelFailures.push(fee.stripe_payment_intent_id);
      continue;
    }
    try {
      await stripeRequest(env, `/payment_intents/${fee.stripe_payment_intent_id}/cancel`, {
        method: "POST",
      });
      cancelled.push(fee.stripe_payment_intent_id);
      await admin
        .from("booking_entitlements")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", fee.id);
    } catch (err) {
      console.error("delete-account: fee hold cancel failed", fee.stripe_payment_intent_id, err);
      cancelFailures.push(fee.stripe_payment_intent_id);
    }
  }

  // A hold we could not release must not be deleted away silently.
  if (cancelFailures.length > 0) {
    return json(
      {
        code: "hold_release_failed",
        error:
          "We couldn't release a hold on your card, so we've stopped. Message the concierge and we'll sort it, then try again.",
      },
      409,
    );
  }

  // --- 3. Skip queued notification deliveries -------------------------------
  const { data: pendingEvents } = await admin
    .from("notification_events")
    .select("id")
    .eq("user_id", userId);
  const eventIds = (pendingEvents ?? []).map((e: { id: string }) => e.id);
  let skippedDeliveries = 0;
  if (eventIds.length > 0) {
    const { data: skipped } = await admin
      .from("notification_deliveries")
      .update({ status: "skipped", last_error: "account_deleted" })
      .in("event_id", eventIds)
      .eq("status", "pending")
      .select("id");
    skippedDeliveries = skipped?.length ?? 0;
  }

  // --- 4. Tell ops before the rows disappear --------------------------------
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser?.user?.email ?? "unknown";
  const openTasks = tasks.filter((t) => !TERMINAL_STATUSES.has(t.status));
  sendOpsAlert({
    event: "account_deleted",
    subject: "Account deleted by customer",
    headline: "A customer deleted their account",
    intro:
      "Their data has been removed. Stop working any open task for this person — the thread no longer exists.",
    lines: [
      { label: "Email", value: email },
      { label: "User", value: userId },
      { label: "Tasks removed", value: String(tasks.length) },
      { label: "Open tasks at deletion", value: String(openTasks.length) },
      { label: "Holds released", value: String(cancelled.length) },
      { label: "Emails cancelled", value: String(skippedDeliveries) },
    ],
    taskId: userId,
  });

  // --- 5. Single cleanup place ---------------------------------------------
  const { data: counts, error: rpcErr } = await admin.rpc("delete_user_data", {
    _user_id: userId,
  });
  if (rpcErr) {
    console.error("delete-account: delete_user_data failed", rpcErr);
    return json({ error: "We couldn't complete the deletion. Please try again." }, 500);
  }

  // --- 6. The auth user itself ---------------------------------------------
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("delete-account: auth delete failed", delErr);
    return json({ error: "We couldn't complete the deletion. Please try again." }, 500);
  }

  console.log("delete-account: completed", userId, JSON.stringify(counts));
  return json({
    deleted: true,
    holdsReleased: cancelled.length,
    emailsCancelled: skippedDeliveries,
    counts,
  });
}));
