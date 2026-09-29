import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Origin is set per-request by `withCors`; this object only carries the
// non-origin headers used by inner responses.
const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

const supported = new Set(Object.keys(FALLBACK_RATES_TO_CNY));

const getFallbackRate = (from: string, to: string) => {
  const fromToCny = FALLBACK_RATES_TO_CNY[from];
  const toToCny = FALLBACK_RATES_TO_CNY[to];
  if (!fromToCny || !toToCny) return null;
  return fromToCny / toToCny;
};

const fetchLiveRate = async (from: string, to: string) => {
  if (from === to) return 1;
  const url = `https://api.frankfurter.app/latest?amount=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`FX provider returned ${response.status}`);
  const data = await response.json();
  const rate = Number(data?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid FX provider response");
  return rate;
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;

  try {
    const { from, to, amount } = await req.json();
    if (!from || !to || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "from, to, amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = String(from).trim().toUpperCase();
    const quote = String(to).trim().toUpperCase();
    if (!supported.has(base) || !supported.has(quote)) {
      return new Response(JSON.stringify({ error: "Unsupported currency" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let usedFallback = false;
    let rate = await fetchLiveRate(base, quote).catch((error) => {
      console.error("live fx provider failed:", error);
      usedFallback = true;
      return getFallbackRate(base, quote);
    });

    if (!rate) {
      return new Response(JSON.stringify({ error: "FX quote unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      rate,
      converted: amount * rate,
      trend: usedFallback ? "Indicative fallback rate" : "Live mid-market rate",
      tip: "Rates move during the day; compare card and ATM fees before topping up.",
      source: usedFallback ? "fallback" : "frankfurter",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fx-check error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
