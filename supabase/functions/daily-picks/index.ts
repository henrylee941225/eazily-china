// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * A "pick" returned to the client. Every field is grounded in a real Amap POI:
 *  - `title` is the English/transliterated venue name from DeepSeek, used for display.
 *  - `title_zh`, `address`, `meta` (district) and `source_url` all come from
 *    the Amap Web Service POI we resolved the venue to.
 * We deliberately do NOT include star ratings or prices because we have no
 * verified live source for either.
 */
type Pick = {
  title: string;
  title_zh: string;
  tag: string;
  category?: string;
  blurb: string;
  meta: string;          // Amap district (adname) — short location label
  address: string;       // Amap full address
  source_url: string;    // Amap public detail page
  accent: "violet" | "cyan" | "amber";
};

// Per-city in-memory cache, keyed by UTC date.
const cache = new Map<string, { date: string; picks: Pick[] }>();
const todayUTC = () => new Date().toISOString().slice(0, 10);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Stable signature for an interests list — used in cache keys/paths so
// signed-in users with different interests get distinct cached results.
function interestsSig(interests: string[]): string {
  if (!interests.length) return "none";
  return [...interests].map((s) => s.toLowerCase()).sort().join("-").slice(0, 80);
}

// Persistent cache via the existing public `pick-images` bucket — we just
// drop a small JSON object per city+date. Any edge instance (cold or warm)
// can read it instantly, so only the FIRST user of the day per city pays
// the DeepSeek latency.
function picksObjectPath(city: string, date: string, interests: string[]) {
  // v4 = interests-aware + category field on picks.
  return `_daily-picks/v4/${slug(city)}/${interestsSig(interests)}/${date}.json`;
}
function picksPublicUrl(city: string, date: string, interests: string[]) {
  const base = Deno.env.get("SUPABASE_URL");
  return `${base}/storage/v1/object/public/pick-images/${picksObjectPath(city, date, interests)}`;
}

/**
 * DeepSeek doesn't know what's on Amap, and we don't trust it for live reviews.
 * So we use it only to brainstorm 12 candidate VENUE NAMES for the city
 * (in Chinese, so Amap can resolve them) along with a category tag and a
 * short factual English description. Every candidate is then verified by
 * the Amap POI search — anything Amap can't find is dropped.
 */
const SYSTEM = `You are a meticulous local-travel curator for Western tourists in Chinese cities.

Your output is consumed by a backend that resolves every venue against the
Amap (高德地图) Web Service POI database. If Amap cannot find a venue, it is
thrown away — so only suggest real, currently-operating, well-known places.

HARD RULES:
- Only suggest venues that genuinely exist and that Amap will recognise.
- Never invent venues, neighbourhoods or descriptions.
- Prefer well-known, long-established venues over obscure ones.
- "name_zh" MUST be the venue's exact Chinese name as it appears on Amap.
- "name_en" MUST be the conventional English name (or pinyin transliteration without tone marks).
- "blurb" must be ONE concise English sentence describing what the place is and why a traveller would go. No prices, no review counts, no "AI" phrasing, no emojis.
- Return STRICT JSON only.`;

const INTEREST_HINTS: Record<string, string> = {
  art: "art galleries, museums, design districts, creative spaces",
  party: "bars, rooftop lounges, speakeasies, nightlife",
  cafes: "specialty coffee shops, tea houses, slow brunch spots",
  touring: "iconic sights, landmarks, temples, gardens, viewpoints",
  foodie: "destination restaurants, local cuisine, street food legends",
  hidden: "hidden gems, alley spots, lesser-known local favourites",
  luxury: "premium / Michelin / high-end venues with refined service",
  budget: "cheap & cheerful, street eats, free or low-cost spots",
};

function buildPrompt(city: string, interests: string[]) {
  const tailored = interests
    .map((i) => INTEREST_HINTS[i.toLowerCase()])
    .filter(Boolean);

  const tailoring = tailored.length
    ? `\n\nThe traveller has explicitly chosen these interests: ${interests.join(", ")}.
Bias HEAVILY toward: ${tailored.join("; ")}.
At least 8 of the 12 candidates MUST clearly match one or more of these interests. Do not pad with generic tourist must-sees that ignore the interests.`
    : "";

  return `Suggest 12 candidate venues for a Western traveller in ${city}, China.${tailoring}

Mix across categories: include at least one of each of "Must-see", "Skyline view", "Foodie pick", "Hidden gem", "Local favourite", "Quiet spot". No duplicates.

Return JSON in this exact shape:
{
  "candidates": [
    {
      "name_zh": "Exact Chinese name as it appears on Amap (高德地图)",
      "name_en": "Conventional English or pinyin name (no Chinese characters in this field)",
      "tag": "One of: Must-see | Foodie pick | Hidden gem | Local favourite | Quiet spot | Skyline view",
      "category": "What the venue factually is. MUST be one of: restaurant | cafe | bar | attraction | museum | gallery | park | temple | shopping | view. If you are genuinely uncertain, omit the field — do NOT guess.",
      "blurb": "ONE English sentence, max 110 chars, describing what it is and why go. Plain text.",
      "accent": "violet | cyan | amber"
    }
  ]
}

Rules:
- Exactly 12 candidates (we will verify and trim to ~8).
- Vary "accent" across the list.
- Do not include URLs, prices, ratings or review counts.`;
}

type Candidate = {
  name_zh: string;
  name_en: string;
  tag: string;
  category?: string;
  blurb: string;
  accent: "violet" | "cyan" | "amber";
};

function parseCandidates(raw: unknown): Candidate[] {
  const tags = new Set([
    "Must-see",
    "Foodie pick",
    "Hidden gem",
    "Local favourite",
    "Quiet spot",
    "Skyline view",
  ]);
  const accents = new Set(["violet", "cyan", "amber"]);
  const categories = new Set([
    "restaurant","cafe","bar","attraction","museum","gallery","park","temple","shopping","view",
  ]);
  const arr = (raw as { candidates?: unknown[] })?.candidates;
  if (!Array.isArray(arr)) return [];
  const out: Candidate[] = [];
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const name_zh = String(o.name_zh ?? "").trim();
    const name_en = String(o.name_en ?? "")
      // Strip CJK from English field
      .replace(/[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/g, "")
      .trim();
    const tag = tags.has(String(o.tag)) ? String(o.tag) : "Hidden gem";
    // Category is strictly validated — anything outside the allowed list is
    // dropped, not defaulted. Missing = no category shown.
    const catRaw = String(o.category ?? "").trim().toLowerCase();
    const category = categories.has(catRaw) ? catRaw : undefined;
    const blurb = String(o.blurb ?? "").trim().slice(0, 140);
    const accent = accents.has(String(o.accent))
      ? (String(o.accent) as Candidate["accent"])
      : "violet";
    if (!name_zh || !name_en || !blurb) continue;
    out.push({ name_zh, name_en, tag, category, blurb, accent });
  }
  return out.slice(0, 12);
}

/**
 * Verify a candidate against the Amap text-search POI endpoint.
 * Returns the enriched pick if Amap returns a credible match, else null.
 * Docs: https://lbs.amap.com/api/webservice/guide/api-advanced/newpoisearch
 */
async function verifyOnAmap(
  candidate: Candidate,
  cityZh: string,
  amapKey: string,
): Promise<Pick | null> {
  const url = new URL("https://restapi.amap.com/v5/place/text");
  url.searchParams.set("key", amapKey);
  url.searchParams.set("keywords", candidate.name_zh);
  url.searchParams.set("region", cityZh);
  url.searchParams.set("city_limit", "true");
  url.searchParams.set("page_size", "5");

  try {
    const r = await fetch(url.toString());
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== "1" || !Array.isArray(j.pois) || j.pois.length === 0) return null;

    // Prefer a POI whose name actually contains the search term, to guard
    // against Amap returning a vaguely-related fallback POI.
    const poi =
      j.pois.find((p: { name?: string }) =>
        typeof p.name === "string" && p.name.includes(candidate.name_zh),
      ) ?? j.pois[0];

    const id = String(poi?.id ?? "").trim();
    const name = String(poi?.name ?? "").trim();
    if (!id || !name) return null;

    const district = String(poi?.adname ?? poi?.cityname ?? "").trim();
    const address = String(poi?.address ?? "").trim();

    return {
      title: candidate.name_en,
      title_zh: name,
      tag: candidate.tag,
      category: candidate.category,
      blurb: candidate.blurb,
      meta: district,
      address: address || district,
      source_url: `https://www.amap.com/place/${encodeURIComponent(id)}`,
      accent: candidate.accent,
    };
  } catch (e) {
    console.warn("Amap verify failed for", candidate.name_zh, e);
    return null;
  }
}

function sanitize(raw: any): Pick[] | null {
  if (!raw || !Array.isArray(raw.picks)) return null;
  const tags = new Set([
    "Must-see",
    "Foodie pick",
    "Hidden gem",
    "Trending now",
    "Quiet now",
    "Skyline view",
  ]);
  const accents = new Set(["violet", "cyan", "amber"]);
  const stripCJK = (s: string) =>
    s
      .replace(/[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/g, "")
      .replace(/\s*[（(]\s*[)）]\s*/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  const out: Pick[] = [];
  for (const p of raw.picks.slice(0, 10)) {
    if (!p || typeof p !== "object") continue;
    const title = stripCJK(String(p.title ?? "")).slice(0, 60);
    const tag = tags.has(p.tag) ? p.tag : "Hidden gem";
    const blurb = stripCJK(String(p.blurb ?? "")).slice(0, 140);
    const meta = stripCJK(String(p.meta ?? "")).slice(0, 40);
    const accent = accents.has(p.accent) ? p.accent : "violet";
    const rating = Math.min(4.9, Math.max(4.5, Number(p.rating) || 4.7));
    const dianping_signal = stripCJK(String(p.dianping_signal ?? "")).slice(0, 180) || undefined;
    if (!title || !blurb) continue;
    out.push({ title, tag, blurb, meta, rating, accent, dianping_signal });
  }
  return out.length ? out : null;
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit("daily-picks", auth.userId, corsHeaders);
  if (limited instanceof Response) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const city = typeof body?.city === "string" ? body.city : "";
    const cityZh = typeof body?.cityZh === "string" ? body.cityZh : "";
    const interestsRaw = Array.isArray(body?.interests) ? body.interests : [];
    const interests = interestsRaw
      .filter((s: unknown): s is string => typeof s === "string")
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => /^[a-z]{2,20}$/.test(s))
      .slice(0, 8);
    if (!city || !cityZh) {
      return new Response(JSON.stringify({ error: "Missing 'city' or 'cityZh'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (city.length > 80 || cityZh.length > 40) {
      return new Response(JSON.stringify({ error: "city too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const date = todayUTC();
    const key = `${city.toLowerCase()}|${interestsSig(interests)}|${date}`;
    const cached = cache.get(key);
    if (cached && cached.date === date) {
      return new Response(JSON.stringify({ date, city, picks: cached.picks, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try persistent storage cache (shared across instances/users).
    try {
      const r = await fetch(picksPublicUrl(city, date, interests), { cache: "no-store" });
      if (r.ok) {
        const json = await r.json();
        if (Array.isArray(json?.picks) && json.picks.length) {
          cache.set(key, { date, picks: json.picks });
          return new Response(
            JSON.stringify({ date, city, picks: json.picks, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    } catch (_) { /* fall through to fresh fetch */ }

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const AMAP_KEY = Deno.env.get("AMAP_WEB_SERVICE_KEY");
    if (!DEEPSEEK_API_KEY || !AMAP_KEY) {
      console.error("Missing DEEPSEEK_API_KEY or AMAP_WEB_SERVICE_KEY");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildPrompt(city, interests) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("DeepSeek error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    let parsed: unknown = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      console.error("Failed to parse DeepSeek JSON:", raw);
    }
    const candidates = parseCandidates(parsed);
    if (!candidates.length) {
      return new Response(JSON.stringify({ error: "Bad AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify each candidate against Amap in parallel; drop any that don't resolve.
    const verified = (await Promise.all(
      candidates.map((c) => verifyOnAmap(c, cityZh, AMAP_KEY)),
    )).filter((p): p is Pick => p !== null);

    // De-dupe by Amap title_zh (Amap sometimes resolves two candidates
    // to the same POI — keep the first occurrence only).
    const seen = new Set<string>();
    const picks: Pick[] = [];
    for (const p of verified) {
      if (seen.has(p.title_zh)) continue;
      seen.add(p.title_zh);
      picks.push(p);
      if (picks.length >= 8) break;
    }

    if (picks.length < 4) {
      console.warn("daily-picks: only", picks.length, "verified picks for", city);
      return new Response(
        JSON.stringify({ error: "Could not verify enough venues today" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    cache.set(key, { date, picks });

    // Persist for other users/instances today. Best-effort; failure is fine.
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_ROLE) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const body = new TextEncoder().encode(JSON.stringify({ date, city, picks }));
        await admin.storage.from("pick-images").upload(
          picksObjectPath(city, date, interests),
          body,
          { contentType: "application/json", upsert: true, cacheControl: "86400" },
        );
      }
    } catch (e) {
      console.warn("daily-picks persist failed", e);
    }

    return new Response(JSON.stringify({ date, city, picks, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-picks error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
