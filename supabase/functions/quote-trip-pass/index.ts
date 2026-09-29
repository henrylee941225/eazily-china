// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Returns the locked Trip Pass charge for the authenticated user's
// preferred currency, using the same fx-lock path as create-pass-checkout.
// No side effects — safe for the UI to call on render to display the
// exact amount the user will be charged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  DEFAULT_CHARGE_CURRENCY,
  FX_MARKUP,
  STRIPE_SUPPORTED,
  ZERO_DECIMAL,
  lockCharge,
} from "../_shared/fx-lock.ts";

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

const FLAT_PRICE_GBP_CENTS = 999;

const FALLBACK_RATES_TO_CNY: Record<string, number> = {
  CNY: 1,
  USD: 7.24,
  EUR: 7.85,
  GBP: 9.15,
  JPY: 0.047,
  AUD: 4.72,
  CAD: 5.25,
  CHF: 8.35,
  HKD: 0.93,
  SGD: 5.55,
  NZD: 4.35,
  KRW: 0.0053,
  INR: 0.087,
  THB: 0.21,
  MYR: 1.62,
  IDR: 0.00046,
  PHP: 0.13,
  MXN: 0.36,
  BRL: 1.32,
  ZAR: 0.39,
  SEK: 0.69,
  NOK: 0.68,
};

const roundClean = (amount: number, currency: string): number => {
  if (ZERO_DECIMAL.has(currency)) return Math.round(amount);
  return Math.round(amount * 2) / 2;
};

const fallbackLockCharge = (quotedGbpCents: number, preferredCurrencyRaw: string | null | undefined) => {
  const pref = String(preferredCurrencyRaw ?? "").toUpperCase();
  const target = STRIPE_SUPPORTED.has(pref) ? pref : DEFAULT_CHARGE_CURRENCY;
  const fellBackToDefault = target !== pref;

  if (target === "GBP") {
    return {
      charge_amount_cents: quotedGbpCents,
      charge_currency: "GBP",
      fx_rate_used: 1,
      quoted_gbp_cents: quotedGbpCents,
      fell_back_to_default: fellBackToDefault,
    };
  }

  const gbpToCny = FALLBACK_RATES_TO_CNY.GBP;
  const targetToCny = FALLBACK_RATES_TO_CNY[target];
  if (!gbpToCny || !targetToCny) return null;

  const marked = (gbpToCny / targetToCny) * (1 + FX_MARKUP);
  const cleanMajor = roundClean((quotedGbpCents / 100) * marked, target);
  const chargeAmountCents = ZERO_DECIMAL.has(target)
    ? Math.round(cleanMajor)
    : Math.round(cleanMajor * 100);

  return {
    charge_amount_cents: chargeAmountCents,
    charge_currency: target,
    fx_rate_used: Number(marked.toFixed(8)),
    quoted_gbp_cents: quotedGbpCents,
    fell_back_to_default: fellBackToDefault,
  };
};

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization header" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json(500, { error: "Backend not configured" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Invalid session" });

    const { data: profileRow } = await userClient
      .from("profiles")
      .select("preferred_currency")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const pref = String((profileRow?.preferred_currency as string | null) ?? "GBP").toUpperCase();

    const locked = await lockCharge(FLAT_PRICE_GBP_CENTS, pref).catch((error) => {
      console.error("quote-trip-pass live fx failed:", error);
      return fallbackLockCharge(FLAT_PRICE_GBP_CENTS, pref);
    });
    if (!locked) return json(503, { error: "FX quote unavailable" });

    console.info(
      `quote-trip-pass success: ${locked.charge_currency} ${locked.charge_amount_cents} (quoted GBP ${FLAT_PRICE_GBP_CENTS})`,
    );

    return json(200, {
      quoted_gbp_cents: FLAT_PRICE_GBP_CENTS,
      charge_amount_cents: locked.charge_amount_cents,
      charge_currency: locked.charge_currency,
      fx_rate_used: locked.fx_rate_used,
      fell_back_to_default: locked.fell_back_to_default,
    });
  } catch (err) {
    console.error("quote-trip-pass error:", err);
    return json(502, { error: "Couldn't quote the pass right now" });
  }
}));
