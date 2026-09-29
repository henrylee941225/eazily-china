// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Creates a Stripe Checkout session for a concierge task priced in the
// task's locked currency. Same pattern as create-pass-checkout: the
// caller (the traveller) must be signed in; environment comes from the
// client's publishable token prefix and never auto-promotes to live.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { stripeRequest, type StripeEnv } from "../_shared/stripe.ts";
import { requireRequestStripeEnv } from "../_shared/payments-env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: "Backend not configured" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Invalid session" });
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.task_id ?? "");
    const returnUrl = String(body?.return_url ?? "");
    if (!taskId) return json(400, { error: "task_id required" });
    if (!returnUrl || !/^https?:\/\//.test(returnUrl)) {
      return json(400, { error: "return_url must be an absolute http(s) URL" });
    }

    // Server-side environment authority: the request Origin decides, nothing
    // else. `body.environment` is only a declaration from the client build —
    // a mismatch is rejected, never obeyed. See _shared/payments-env.ts.
    const envR = requireRequestStripeEnv(
      req,
      "create-task-checkout",
      body?.environment != null ? String(body.environment) : null,
    );
    if ("response" in envR) return envR.response;
    const env: StripeEnv = envR.env;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: task, error: taskErr } = await admin
      .from("concierge_tasks")
      .select("id,user_id,status,summary,category,price_cents,currency,charge_amount_cents,charge_currency,quoted_gbp_cents,quoted_cny_cents,paid_at,stripe_session_id,details_json")
      .eq("id", taskId)
      .maybeSingle();
    if (taskErr || !task) return json(404, { error: "Task not found" });
    if (task.user_id !== user.id) return json(403, { error: "Forbidden" });
    if (task.paid_at) return json(409, { error: "Task already paid" });
    if (task.status !== "pay_to_confirm") return json(409, { error: "Task not awaiting payment" });

    // Charge the customer in their locked charge currency. Legacy tasks
    // pre-dating the GBP switch may only have price_cents/currency set.
    const priceCents = Number(task.charge_amount_cents ?? task.price_cents ?? 0);
    const currency = String(task.charge_currency ?? task.currency ?? "").toLowerCase();
    const gbpCents = Number(
      task.quoted_gbp_cents
        ?? (String(task.currency).toUpperCase() === "GBP" ? task.price_cents : 0)
        ?? 0,
    );
    const legacyCnyCents = Number(task.quoted_cny_cents ?? 0);
    if (!Number.isInteger(priceCents) || priceCents < 1) {
      return json(409, { error: "Task charge amount is not set" });
    }
    if (!/^[a-z]{3}$/.test(currency)) return json(409, { error: "Task currency is invalid" });

    // Authorise vs immediate-charge branch.
    // Card authorisations expire ~7 days. If the pickup is >6 days out we
    // fall back to automatic capture (charged now, refunded on unavailable)
    // rather than risk the hold lapsing before the driver is confirmed.
    // Non-transfer tasks and transfers without a parseable pickup_at also
    // fall back to automatic capture as a safe default.
    const AUTH_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
    let captureMethod: "manual" | "automatic" = "automatic";
    if (task.category === "transfer") {
      const dj = (task.details_json ?? {}) as Record<string, unknown>;
      const pickupIso = typeof dj.pickup_at === "string" ? dj.pickup_at : "";
      const pickupMs = pickupIso ? Date.parse(pickupIso) : NaN;
      if (Number.isFinite(pickupMs) && pickupMs - Date.now() <= AUTH_WINDOW_MS) {
        captureMethod = "manual";
      }
    }
    // Restaurant booking fee: always manual capture. The entitlement starts
    // at authorisation and the fee is only captured when ops confirms the
    // first booking; if nothing is ever confirmed the hold is released.
    if (task.category === "restaurant_reservation") {
      captureMethod = "manual";
    }

    const sessionPayload: Record<string, unknown> = {
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Concierge · ${String(task.summary ?? "task").slice(0, 90)}`,
              description: "Fixed price agreed with your assistant.",
              tax_code: "txcd_20030000",
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        description: `Concierge task ${task.id}`,
        capture_method: captureMethod,
        // Mirror the session metadata onto the PaymentIntent so
        // `payment_intent.amount_capturable_updated` (our secondary
        // authorization signal for manual capture) carries `task_id`
        // without a lookup.
        metadata: {
          user_id: user.id,
          product: "concierge_task",
          type: "concierge_task",
          task_id: task.id,
          capture_method: captureMethod,
          charge_amount_cents: String(priceCents),
          charge_currency: currency,
        },
      },
      metadata: {
        user_id: user.id,
        product: "concierge_task",
        type: "concierge_task",
        task_id: task.id,
        capture_method: captureMethod,
        // Locked charge — the webhook stale-guard compares these.
        charge_amount_cents: String(priceCents),
        charge_currency: currency,
        quoted_gbp_cents: String(gbpCents),
        // Legacy CNY reference kept for old bookings only.
        quoted_cny_cents: String(legacyCnyCents),
        // Legacy fields kept for older webhook fallbacks.
        price_cents: String(priceCents),
        currency,
      },
    };

    const session = await stripeRequest<{ id: string; client_secret: string }>(
      env,
      "/v1/checkout/sessions",
      { body: sessionPayload },
    );

    await admin
      .from("concierge_tasks")
      .update({ stripe_session_id: session.id, capture_method: captureMethod, stripe_env: env })
      .eq("id", task.id);

    return json(200, {
      session_id: session.id,
      client_secret: session.client_secret,
      env,
      capture_method: captureMethod,
    });
  } catch (err) {
    console.error("create-task-checkout error:", err);
    return json(500, { error: "Internal server error" });
  }
}));
