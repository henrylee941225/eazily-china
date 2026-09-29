import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  appendRecentlyRecommended,
  readRecentlyRecommended,
  shuffle,
} from "../_shared/recently-recommended.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Recommends a Shanghai restaurant grounded strictly in the curated venue
// index the client passes in. The model may ONLY select ids from that list;
// server validates before responding so the frontend can trust the result
// (and fall back to the human-picks-it card if we return an error).
const SYSTEM_PROMPT = `You are eazilyChina's restaurant concierge AI. You receive a Western traveller's stated preferences and a curated list of real Shanghai restaurants (each with an id, English name, Chinese name where available, district, price marker, tag and short blurb).

Rules — non-negotiable:
- You may ONLY choose venues whose id appears in the provided list. Never invent a venue, name, address or detail.
- Pick the CLOSEST match to the preferences. Do NOT refuse. If nothing is perfect, choose the best sensible compromise from the list.
- Reason must be one or two short sentences, written to the user in second person ("you"), referencing at least one of their stated preferences. UK English. No emoji.
- Also nominate one different venue id from the list as the alternative.
- Return a single JSON object and nothing else — no prose, no code fences, no markdown.

JSON shape:
{"venue_id":"<id from list>","reason":"<1–2 sentences>","alternative_id":"<different id from list>"}`;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Gate matches concierge-create-task: active pass OR no prior restaurant
    // task (the first booking is free), so a first-time user sees their
    // recommendation before any paywall.
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const limited = await enforceRateLimit("recommend-restaurant", auth.userId, corsHeaders);
    if (limited instanceof Response) return limited;
    const userId = auth.userId;

    const body = await req.json().catch(() => null);
    const preferences = body?.preferences ?? {};
    const venuesInput = Array.isArray(body?.venues) ? body.venues : [];
    const excludeIds: string[] = Array.isArray(body?.exclude_ids)
      ? body.exclude_ids.filter((x: unknown) => typeof x === "string")
      : [];

    if (venuesInput.length === 0) {
      return new Response(JSON.stringify({ error: "venues required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Whitelist candidate ids after applying the caller's hard exclusion set
    // (Path B "Show another" state).
    const excluded = new Set(excludeIds);
    const hardFiltered = venuesInput.filter(
      (v: { id?: unknown }) =>
        typeof v?.id === "string" && !excluded.has(v.id as string),
    );

    // Soft cross-session rotation: on a healthy pool (>6), drop venues we
    // recently recommended to this user. On thin pools we skip rotation so
    // users are never starved by their own history.
    let rotated = hardFiltered;
    if (hardFiltered.length > 6) {
      const recent = new Set(await readRecentlyRecommended(userId));
      if (recent.size > 0) {
        const filtered = hardFiltered.filter(
          (v: { id?: unknown }) => typeof v?.id === "string" && !recent.has(v.id as string),
        );
        if (filtered.length > 0) rotated = filtered;
      }
    }

    // Shuffle after filtering, before the size cap, to break position bias.
    const allowed = shuffle([...rotated]).slice(0, 60);

    if (allowed.length === 0) {
      return new Response(JSON.stringify({ error: "no_candidates" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPayload = JSON.stringify({
      preferences,
      venues: allowed,
    });

    const upstream = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      console.error("recommend-restaurant upstream error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: { venue_id?: unknown; reason?: unknown; alternative_id?: unknown } | null = null;
    try { parsed = JSON.parse(content); } catch { /* handled below */ }

    const idSet = new Set(allowed.map((v: { id: string }) => v.id));
    const venueId = typeof parsed?.venue_id === "string" ? parsed.venue_id : null;
    if (!venueId || !idSet.has(venueId)) {
      console.warn("recommend-restaurant: model returned invalid venue_id", venueId);
      return new Response(JSON.stringify({ error: "invalid_selection" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const altRaw = typeof parsed?.alternative_id === "string" ? parsed.alternative_id : null;
    const alternativeId = altRaw && altRaw !== venueId && idSet.has(altRaw) ? altRaw : null;
    const reason = typeof parsed?.reason === "string"
      ? parsed.reason.trim().slice(0, 400)
      : "";

    // Persist what we surfaced so the next call for this user can rotate
    // around it. We include the alternative too — it's on-screen for the
    // user. Best-effort; never block the response.
    const persistIds = [venueId, ...(alternativeId ? [alternativeId] : [])];
    appendRecentlyRecommended(userId, persistIds).catch((e) =>
      console.warn("recommend-restaurant: persist recent failed:", e)
    );

    return new Response(
      JSON.stringify({ venue_id: venueId, reason, alternative_id: alternativeId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("recommend-restaurant error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
