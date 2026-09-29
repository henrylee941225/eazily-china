// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Side-effect-free quote endpoint for transfer pricing. Takes one or more
// GBP-canonical rate-card amounts (in minor units) and returns the exact
// charge amounts the customer will be locked at, using the SAME shared
// helpers (`applyLock` / `markedRateFor`) that `lockCharge` uses at booking.
// Auth required. No writes, no side effects.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { applyLock, markedRateFor, resolveTargetCurrency } from "../_shared/fx-lock.ts";

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

const MAX_ITEMS = 24;

Deno.serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

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

    const body = await req.json().catch(() => ({}));
    const raw = (body as { gbp_cents?: unknown }).gbp_cents;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
      return json(400, { error: "gbp_cents must be an array of 1–24 amounts" });
    }
    const amounts: number[] = [];
    for (const v of raw) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 100_000_00) {
        return json(400, { error: "invalid amount in gbp_cents" });
      }
      amounts.push(Math.round(n));
    }

    const { data: profileRow } = await userClient
      .from("profiles")
      .select("preferred_currency")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const { target, fell_back_to_default } = resolveTargetCurrency(
      (profileRow?.preferred_currency as string | null) ?? "GBP",
    );

    let marked: number;
    try {
      marked = await markedRateFor(target);
    } catch (e) {
      console.error("quote-transfer live fx failed:", e);
      return json(503, { error: "FX quote unavailable" });
    }

    const quotes = amounts.map((cents) => {
      const locked = applyLock(cents, target, marked, fell_back_to_default);
      return {
        quoted_gbp_cents: locked.quoted_gbp_cents,
        charge_amount_cents: locked.charge_amount_cents,
        charge_currency: locked.charge_currency,
        fx_rate_used: locked.fx_rate_used,
      };
    });

    console.info(
      `quote-transfer success: ${target} x${quotes.length} (rate ${marked.toFixed(6)})`,
    );

    return json(200, {
      charge_currency: target,
      fx_rate_used: Number(marked.toFixed(8)),
      fell_back_to_default,
      quotes,
    });
  } catch (err) {
    console.error("quote-transfer error:", err);
    return json(502, { error: "Couldn't quote right now" });
  }
}));
