import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM = `You are a meticulous local-travel guide for Western tourists in China.

You describe well-known venues and experiences using general, timeless knowledge only. If you are not confident the venue genuinely exists, set "verified" to false and briefly suggest a safer, well-known alternative in "summary".

HONESTY RULE (STRICT): You have no access to live data. Never invent or state specific statistics — no star ratings, review counts, prices, wait times, opening hours, seasonal dates, or time-anchored claims such as "this week", "recently", "currently trending", "as of 2024/2025", "newly opened". Do not cite Dianping, Yelp, guidebooks, or any source as if you looked it up. Write description, not data.

LANGUAGE RULE (STRICT): Every string you output MUST be in English only. Do NOT include any Chinese characters, pinyin tone marks, or other CJK scripts in any field. If a place is commonly known by a Chinese name, use its standard English name or a romanised English transliteration without tone marks. No Chinese in parentheses, no mixed-language strings.

Output STRICT JSON only — no markdown, no commentary, no code fences.`;

type Detail = {
  verified: boolean;
  summary: string;
  highlights: string[];
  best_time: string;
  how_to_get_there: string;
  what_to_order_or_see: string[];
  insider_tip: string;
  address?: string;
};

const cache = new Map<string, Detail>();

function sanitize(raw: any): Detail | null {
  if (!raw || typeof raw !== "object") return null;
    // Remove any CJK characters and tidy up whitespace/punctuation left behind.
    const stripCJK = (s: string) =>
      s
        .replace(/[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/g, "")
        .replace(/\s*[（(]\s*[)）]\s*/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim();
    const str = (v: any, max = 280) => stripCJK(String(v ?? "")).slice(0, max);
    const arrClean = (v: any, max = 5) =>
      Array.isArray(v)
        ? v.map((x) => stripCJK(String(x))).filter(Boolean).slice(0, max)
        : [];
  const out: Detail = {
    verified: raw.verified !== false,
    summary: str(raw.summary, 300),
    highlights: arrClean(raw.highlights, 5),
    best_time: str(raw.best_time, 140),
    how_to_get_there: str(raw.how_to_get_there, 220),
    what_to_order_or_see: arrClean(raw.what_to_order_or_see, 5),
    insider_tip: str(raw.insider_tip, 220),
    address: str(raw.address, 220) || undefined,
  };
  if (!out.summary && out.highlights.length === 0) return null;
  return out;
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const { city, title, tag, blurb } = await req.json();
    if (!city || !title) {
      return new Response(JSON.stringify({ error: "Missing 'city' or 'title'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cityStr = String(city).slice(0, 80);
    const titleStr = String(title).slice(0, 120);
    const tagStr = tag != null ? String(tag).slice(0, 60) : "";
    const blurbStr = blurb != null ? String(blurb).slice(0, 300) : "";

    const key = `${cityStr.toLowerCase()}|${titleStr.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) {
      return new Response(JSON.stringify({ detail: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Place: "${titleStr}" in ${cityStr}, China.
Context tag: ${tagStr || "n/a"}. Short blurb: ${blurbStr || "n/a"}.

First, decide if you are confident this venue/experience really exists in ${city}. If not, set "verified": false and write a one-sentence "summary" suggesting a safer, well-known alternative — leave the other fields empty arrays/strings.

If verified, return concise, descriptive info for a Western traveller, using only general, timeless knowledge. Do NOT include specific ratings, review counts, prices, hours, or time-anchored claims. JSON shape:
{
  "verified": true,
  "summary": "1–2 sentence overview (max 280 chars). Description, not data.",
  "highlights": ["3–5 short bullets, each <= 90 chars, describing what makes the place notable — atmosphere, dish style, architecture, history. No numbers, no ratings, no dates."],
  "best_time": "General guidance such as 'early evening' or 'weekday mornings'. No specific times or dates.",
  "how_to_get_there": "Nearest metro line/station or general walking/taxi guidance — one short sentence.",
  "what_to_order_or_see": ["2–4 specific dishes, exhibits, or sights the venue is generally known for."],
  "insider_tip": "One non-obvious tip a local would share (which room to sit in, which entrance is quieter, what to try first).",
  "address": "Full street address in English (street number, street, district, city). Romanise Chinese place names without tone marks. No Chinese characters."
}

Plain text English only inside strings. No Chinese characters, no other CJK scripts, no markdown, no emojis, no URLs, no fabricated statistics.`;

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
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
    let parsed: any = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      console.error("Failed to parse DeepSeek JSON:", raw);
    }
    const detail = sanitize(parsed);
    if (!detail) {
      return new Response(JSON.stringify({ error: "Bad AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    cache.set(key, detail);
    return new Response(JSON.stringify({ detail, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pick-detail error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
