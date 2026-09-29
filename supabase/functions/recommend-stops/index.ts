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

// ─── Slots and their allowed pick categories ────────────────────────────────
// Uncategorised picks are excluded — we can't confirm slot fit without a
// factual category label. Area filtering is separate and softer (see below).
type Slot = "breakfast" | "morning" | "lunch" | "afternoon";

const SLOT_CATEGORIES: Record<Slot, ReadonlyArray<string>> = {
  breakfast: ["cafe", "restaurant"],
  lunch: ["restaurant", "cafe"],
  morning: ["attraction", "museum", "gallery", "park", "temple", "view", "shopping"],
  afternoon: ["attraction", "museum", "gallery", "park", "temple", "view", "shopping"],
};

// Reasonable default duration per slot — used only as guidance for the model.
const SLOT_DEFAULT_MIN: Record<Slot, number> = {
  breakfast: 45,
  lunch: 60,
  morning: 90,
  afternoon: 90,
};

// ─── Curated Shanghai areas (mirrors src/data/shanghaiAreas.ts) ─────────────
// Kept server-side so area filtering doesn't depend on the client sending an
// area→districts mapping. Extend for other cities as they are curated.
const CITY_AREAS: Record<string, Record<string, ReadonlyArray<string>>> = {
  shanghai: {
    "bund": ["The Bund", "Bund", "Huangpu", "Hongkou"],
    "yu-garden": ["Yu Garden", "Old City", "Huangpu"],
    "xintiandi": ["Xintiandi", "Huangpu"],
    "french-concession": ["Former French Concession", "French Concession", "Xuhui"],
    "jingan": ["Jing'an", "Jingan"],
    "west-bund": ["West Bund", "Xuhui"],
  },
};

// ─── Input types (defensive; validated below) ───────────────────────────────
type Venue = {
  id: string;
  name: string;
  name_zh?: string;
  category?: string;   // pick category (restaurant, cafe, attraction, …)
  district?: string;   // explicit district if the pick carries one
  meta?: string;       // fallback location prefix, e.g. "The Bund · ¥¥"
  tag?: string;
  blurb?: string;
};

const isSlot = (s: unknown): s is Slot =>
  s === "breakfast" || s === "morning" || s === "lunch" || s === "afternoon";

const clampInt = (n: unknown, lo: number, hi: number, dflt: number): number => {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
};

// Extract a location hint from `meta` — picks like "The Bund · ¥¥" put the
// district ahead of the ` · ` separator.
const metaLocation = (meta?: string): string | undefined => {
  if (!meta) return undefined;
  const [head] = meta.split("·");
  const trimmed = head?.trim();
  return trimmed || undefined;
};

// A venue matches the requested areas if:
//   - it has no district and no meta location (eligible for all areas), OR
//   - its district/meta location contains any district string of any selected
//     area (case-insensitive substring).
// If the caller passes an empty area list, no area filter is applied.
const matchesAreas = (
  v: Venue,
  areaDistricts: ReadonlyArray<string>,
): boolean => {
  if (areaDistricts.length === 0) return true;
  const loc = v.district || metaLocation(v.meta);
  if (!loc) return true; // no location info → eligible for all areas
  const l = loc.toLowerCase();
  return areaDistricts.some((d) => l.includes(d.toLowerCase()));
};

const SYSTEM_PROMPT = `You are eazilyChina's day-planner AI. You receive a Western traveller's slot (breakfast, morning, lunch or afternoon), optional preferences, and a curated list of real venues in a Chinese city (each with an id, English name, Chinese name where available, district, tag and short blurb).

Your job is SELECTION only. You do not invent, rename, relocate or describe unknown venues.

Rules — non-negotiable:
- You may ONLY choose venues whose id appears in the provided list. Never invent an id, venue, address or detail.
- Pick up to the requested count. Choose FEWER if the list does not contain enough good matches — never pad by reusing venues or inventing new ones.
- Match the slot: breakfast/lunch = a place to eat; morning/afternoon = a place to visit.
- If preferences are provided, prefer venues that fit them, but do not refuse when nothing is perfect — pick the sensible best matches from the list.
- Each pick may include a short "reason" that explains WHY this venue over the others for this traveller — selection context only (e.g. "Quietest of the three for a morning visit.", "Matches your no-chilli preference."). Max ~14 words, one sentence, UK English, no emoji, no marketing language, no second person. The reason MUST NOT restate, summarise or paraphrase the venue's blurb — the card already shows the blurb. If you have no genuine selection context to add, return "reason": "" (an empty string is preferred over paraphrasing the blurb).
- durationMinutes is your suggested time on-site for the slot, an integer between 15 and 180.
- Return a single JSON object and nothing else — no prose, no code fences, no markdown.

JSON shape:
{"picks":[{"id":"<id from list>","reason":"<1 sentence>","durationMinutes":<15-180>}]}`;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const limited = await enforceRateLimit("recommend-stops", auth.userId, corsHeaders);
    if (limited instanceof Response) return limited;
    const userId = auth.userId;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const city = String((body as { city?: unknown }).city ?? "").trim();
    const slot = (body as { slot?: unknown }).slot;
    if (!city || city.length > 80) {
      return new Response(JSON.stringify({ error: "city required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isSlot(slot)) {
      return new Response(JSON.stringify({ error: "slot must be breakfast|morning|lunch|afternoon" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const areasRaw = Array.isArray((body as { areas?: unknown }).areas)
      ? ((body as { areas: unknown[] }).areas)
      : [];
    const areaIds: string[] = areasRaw
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 8);

    const excludeRaw = Array.isArray((body as { exclude?: unknown }).exclude)
      ? ((body as { exclude: unknown[] }).exclude)
      : [];
    const excludeIds = new Set(
      excludeRaw.filter((x): x is string => typeof x === "string").slice(0, 200),
    );

    const count = clampInt((body as { count?: unknown }).count, 1, 6, 3);

    const preferences =
      (body as { preferences?: unknown }).preferences &&
      typeof (body as { preferences?: unknown }).preferences === "object"
        ? (body as { preferences: Record<string, unknown> }).preferences
        : {};

    const venuesInput = Array.isArray((body as { venues?: unknown }).venues)
      ? ((body as { venues: unknown[] }).venues)
      : [];

    // Normalise venues; drop entries missing id/name.
    const venues: Venue[] = [];
    for (const raw of venuesInput.slice(0, 300)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!id || !name) continue;
      venues.push({
        id,
        name,
        name_zh: typeof r.name_zh === "string" ? r.name_zh : undefined,
        category: typeof r.category === "string" ? r.category.toLowerCase() : undefined,
        district: typeof r.district === "string" ? r.district : undefined,
        meta: typeof r.meta === "string" ? r.meta : undefined,
        tag: typeof r.tag === "string" ? r.tag : undefined,
        blurb: typeof r.blurb === "string" ? r.blurb : undefined,
      });
    }

    // ─── Server-side filtering ────────────────────────────────────────────
    const slotCats = SLOT_CATEGORIES[slot];
    const cityKey = city.toLowerCase();
    const cityAreaMap = CITY_AREAS[cityKey] ?? {};
    const areaDistricts: string[] = Array.from(
      new Set(
        areaIds.flatMap((aid) => cityAreaMap[aid] ?? []),
      ),
    );
    // If the caller passed area ids we don't know about, treat as "no
    // area filter" rather than filtering everything out — the wizard
    // should not silently produce an empty page for an unknown area id.
    const effectiveAreaDistricts = areaIds.length > 0 && areaDistricts.length === 0
      ? []
      : areaDistricts;

    const candidates = venues.filter(
      (v) =>
        !excludeIds.has(v.id) &&
        v.category !== undefined &&
        slotCats.includes(v.category) &&
        matchesAreas(v, effectiveAreaDistricts),
    );

    // De-dup by id (defensive — the client may have merged sources).
    const seen = new Set<string>();
    const uniqueCandidates: Venue[] = [];
    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      uniqueCandidates.push(c);
    }

    // If there are no candidates at all, return early — don't burn an AI call
    // and don't invent venues. The wizard should handle empty gracefully.
    if (uniqueCandidates.length === 0) {
      return new Response(
        JSON.stringify({ slot, count: 0, picks: [], candidate_pool: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Soft cross-session rotation: if the post-filter pool has room to spare
    // (>6), drop venues we've recently recommended to this user. On thin
    // pools we skip rotation so users are never starved of results by their
    // own history.
    let rotated = uniqueCandidates;
    if (uniqueCandidates.length > 6) {
      const recent = new Set(await readRecentlyRecommended(userId));
      if (recent.size > 0) {
        const filtered = uniqueCandidates.filter((v) => !recent.has(v.id));
        if (filtered.length > 0) rotated = filtered;
      }
    }

    // Shuffle after filtering, before the size cap, to break position bias
    // and give every call a different subset+ordering.
    const pool = shuffle([...rotated]).slice(0, 60);

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPayload = JSON.stringify({
      slot,
      slot_hint: `Default on-site time around ${SLOT_DEFAULT_MIN[slot]} minutes.`,
      requested_count: Math.min(count, pool.length),
      preferences,
      venues: pool.map((v) => ({
        id: v.id,
        name: v.name,
        name_zh: v.name_zh,
        district: v.district ?? metaLocation(v.meta),
        category: v.category,
        tag: v.tag,
        blurb: v.blurb,
      })),
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
        max_tokens: 800,
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      console.error("recommend-stops upstream error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: { picks?: unknown } | null = null;
    try { parsed = JSON.parse(content); } catch { /* handled below */ }

    const picksRaw = Array.isArray(parsed?.picks) ? (parsed!.picks as unknown[]) : [];
    const idToVenue = new Map(pool.map((v) => [v.id, v]));
    const outSeen = new Set<string>();
    const out: Array<{
      id: string;
      name: string;
      name_zh?: string;
      district?: string;
      category?: string;
      tag?: string;
      blurb?: string;
      reason: string;
      durationMinutes: number;
    }> = [];

    for (const p of picksRaw) {
      if (out.length >= count) break;
      if (!p || typeof p !== "object") continue;
      const o = p as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      if (!id || outSeen.has(id)) continue;
      const venue = idToVenue.get(id);
      if (!venue) {
        // Model returned an id that wasn't in the whitelist → drop silently.
        console.warn("recommend-stops: dropping unknown id", id);
        continue;
      }
      let reason = typeof o.reason === "string"
        ? o.reason.trim().slice(0, 240)
        : "";
      // Drop reasons that near-duplicate the blurb — the card should fall
      // back to the blurb rather than show two lines saying the same thing.
      if (reason && venue.blurb) {
        const norm = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
        const r = norm(reason);
        const b = norm(venue.blurb);
        if (r && b) {
          if (r === b || b.includes(r) || r.includes(b)) {
            reason = "";
          } else {
            const rTokens = new Set(r.split(" ").filter((t) => t.length > 3));
            const bTokens = new Set(b.split(" ").filter((t) => t.length > 3));
            if (rTokens.size > 0) {
              let shared = 0;
              rTokens.forEach((t) => { if (bTokens.has(t)) shared++; });
              if (shared / rTokens.size >= 0.6) reason = "";
            }
          }
        }
      }
      const duration = clampInt(o.durationMinutes, 15, 180, SLOT_DEFAULT_MIN[slot]);
      outSeen.add(id);
      out.push({
        id: venue.id,
        name: venue.name,
        name_zh: venue.name_zh,
        district: venue.district ?? metaLocation(venue.meta),
        category: venue.category,
        tag: venue.tag,
        blurb: venue.blurb,
        reason,
        durationMinutes: duration,
      });
    }

    // Persist what we surfaced so the next call for this user can rotate
    // around it. Best-effort — never block the response on this write.
    if (out.length > 0) {
      appendRecentlyRecommended(userId, out.map((o) => o.id)).catch((e) =>
        console.warn("recommend-stops: persist recent failed:", e)
      );
    }

    return new Response(
      JSON.stringify({
        slot,
        count: out.length,
        picks: out,
        candidate_pool: uniqueCandidates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("recommend-stops error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
