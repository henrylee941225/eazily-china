// LEGACY — no client calls this. trip_passes / profiles.trip_pass_active_until
// are a purchase log only; nothing may gate on them. Restaurant booking access
// is booking_entitlements (booking_entitlement_state RPC).
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { stripeRequest, type StripeEnv } from "../_shared/stripe.ts";
import { requireRequestStripeEnv } from "../_shared/payments-env.ts";
import { lockCharge } from "../_shared/fx-lock.ts";

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

// Trip Pass v2 — flat GBP price for the whole trip, capped at 60 days.
const MAX_TRIP_DAYS = 60;
const FLAT_PRICE_GBP = 9.99;
const FLAT_PRICE_GBP_CENTS = 999;
const CANONICAL_CURRENCY = "GBP";

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: "Backend not configured" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Invalid session" });
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const tripDaysRaw = Number(body?.trip_days ?? 0);
    const tripStart = String(body?.trip_start_date ?? "");
    const tripEnd = String(body?.trip_end_date ?? "");
    const returnUrl = String(body?.return_url ?? "");

    if (!Number.isFinite(tripDaysRaw) || tripDaysRaw < 1) {
      return json(400, { error: "trip_days must be a positive integer" });
    }
    if (!returnUrl || !/^https?:\/\//.test(returnUrl)) {
      return json(400, { error: "return_url must be an absolute http(s) URL" });
    }

    const tripDaysRequested = Math.floor(tripDaysRaw);
    // Cap the pass at 60 days. If the trip is longer, the pass is still
    // valid through trip_end_date up to 60 days from trip_start_date.
    const tripDays = Math.min(tripDaysRequested, MAX_TRIP_DAYS);
    const billableDays = tripDays;
    const totalCents = FLAT_PRICE_GBP_CENTS;

    // Resolve the user's preferred currency, then lock a charge amount at
    // the same live-rate + 3% markup path used for transfers. GBP users
    // pay exactly £9.99. Any FX-provider failure aborts checkout — never
    // guess a rate.
    let preferredCurrency = "GBP";
    {
      const admin0 = createClient(supabaseUrl, serviceKey);
      const { data: profileRow } = await admin0
        .from("profiles")
        .select("preferred_currency")
        .eq("user_id", user.id)
        .maybeSingle();
      const pref = String((profileRow?.preferred_currency as string | null) ?? "").toUpperCase();
      if (pref) preferredCurrency = pref;
    }

    let locked;
    try {
      locked = await lockCharge(FLAT_PRICE_GBP_CENTS, preferredCurrency);
    } catch (fxErr) {
      console.error("create-pass-checkout FX lock failed:", fxErr);
      return json(502, { error: "Couldn't lock currency conversion — please try again." });
    }
    const stripeCurrency = locked.charge_currency.toLowerCase();
    const stripeUnitAmount = locked.charge_amount_cents;

    // Server-side environment authority: the request Origin decides, nothing
    // else. See _shared/payments-env.ts.
    const envR = requireRequestStripeEnv(
      req,
      "create-pass-checkout",
      body?.environment != null ? String(body.environment) : null,
    );
    if ("response" in envR) return envR.response;
    const env: StripeEnv = envR.env;

    // Insert pending trip pass row (lets us reconcile via webhook).
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: passRow, error: insertErr } = await admin
      .from("trip_passes")
      .insert({
        user_id: user.id,
        trip_start_date: tripStart || null,
        trip_end_date: tripEnd || null,
        days_total: tripDays,
        days_billed: billableDays,
        // Column is legacy-named `amount_paid_usd_cents`; we now store
        // the GBP charge in the same integer column.
        amount_paid_usd_cents: totalCents,
        quoted_gbp_cents: totalCents,
        charge_amount_cents: locked.charge_amount_cents,
        charge_currency: locked.charge_currency,
        fx_rate_used: locked.fx_rate_used,
        status: "pending",
        stripe_env: env,
      })
      .select("id")
      .single();
    if (insertErr) console.error("trip_passes insert error:", insertErr);

    const productName =
      tripDaysRequested > MAX_TRIP_DAYS
        ? `Trip Pass · ${tripDays} days (capped from ${tripDaysRequested})`
        : tripDays === 1
          ? "Trip Pass · 1 day"
          : `Trip Pass · ${tripDays} days`;

    const sessionPayload: Record<string, unknown> = {
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      managed_payments: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: productName,
              description: tripStart && tripEnd
                ? `Active ${tripStart} → ${tripEnd}`
                : "Single-purchase pass for your whole trip.",
              tax_code: "txcd_10000000",
            },
            unit_amount: stripeUnitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        product: "trip_pass",
        type: "pass",
        trip_days: String(tripDays),
        billable_days: String(billableDays),
        trip_days_requested: String(tripDaysRequested),
        trip_start_date: tripStart,
        trip_end_date: tripEnd,
        trip_pass_id: passRow?.id ?? "",
        quoted_gbp_cents: String(totalCents),
        charge_amount_cents: String(locked.charge_amount_cents),
        charge_currency: locked.charge_currency,
      },
    };

    const session = await stripeRequest<{ id: string; client_secret: string }>(
      env,
      "/v1/checkout/sessions",
      { body: sessionPayload }
    );

    // Attach the session id to the pass row for webhook lookup.
    if (passRow?.id) {
      await admin
        .from("trip_passes")
        .update({ stripe_session_id: session.id })
        .eq("id", passRow.id);
    }

    return json(200, {
      session_id: session.id,
      client_secret: session.client_secret,
      env,
      total_gbp: FLAT_PRICE_GBP,
      currency: CANONICAL_CURRENCY,
      quoted_gbp_cents: totalCents,
      charge_amount_cents: locked.charge_amount_cents,
      charge_currency: locked.charge_currency,
      fx_rate_used: locked.fx_rate_used,
    });
  } catch (err) {
    console.error("create-pass-checkout error:", err);
    return json(500, { error: "Internal server error" });
  }
}));
