import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are a practical, opinionated day planner for first-time foreign travellers in China. The user has given you the city, time budget, and mood. Plan a realistic day.

Rules:
- Use only real, well-known, publicly accessible places: restaurants, attractions, neighbourhoods, parks, museums, markets
- Each stop must have a clear name findable in a maps app
- Walking time between consecutive stops should be ≤20 minutes ideally
- Cluster stops by neighbourhood when possible — efficient routes beat scattered ones
- Account for typical opening hours
- Match the requested mood faithfully — foodie means food, culture means museums, slow means parks and tea, buzzy means nightlife, photographer's means iconic spots
- Be practical about famous tourist sites; provide useful info, never refuse or hedge on widely-visited locations
- Number of stops should match time budget: 2 hours → 2 stops, 4 hours → 3-4 stops, 6 hours → 4-5 stops, full day → 5-7 stops

Title rules:
- The "title" field must be evocative and specific, not generic
- Reference the time of day implied by the first stop (morning, afternoon, evening, night)
- Reference the mood naturally (foodie, slow, buzzy, photographer's, cultural)
- Reference a specific neighbourhood, landmark, or area when possible
- Examples of good titles: "A foodie afternoon in Shanghai", "Slow morning around Yu Garden", "Buzzy night through the French Concession", "Photographer's hours in the Old Town"
- Avoid generic titles like "Foodie day in Shanghai" or "Your Beijing plan"

Output: JSON only, no markdown, no preamble. Structure:
{
  "title": "A foodie afternoon in Shanghai",
  "totalHours": 6,
  "totalDistanceKm": 4.2,
  "stops": [
    {
      "startTime": "10:30",
      "durationMinutes": 90,
      "placeName": "Yu Garden",
      "neighbourhood": "Old Town · Huangpu",
      "reason": "Classical garden, quietest mid-morning",
      "walkingMinutesToNext": 12
    }
  ]
}`;

type Stop = {
  startTime: string;
  durationMinutes: number;
  placeName: string;
  neighbourhood: string;
  reason: string;
  walkingMinutesToNext: number;
};

type Plan = {
  title: string;
  totalHours: number;
  totalDistanceKm: number;
  stops: Stop[];
};

const isValidPlan = (x: unknown): x is Plan => {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  if (typeof p.title !== "string") return false;
  if (typeof p.totalHours !== "number") return false;
  if (typeof p.totalDistanceKm !== "number") return false;
  if (!Array.isArray(p.stops) || p.stops.length === 0) return false;
  return p.stops.every((s) => {
    if (!s || typeof s !== "object") return false;
    const o = s as Record<string, unknown>;
    return (
      typeof o.startTime === "string" &&
      typeof o.durationMinutes === "number" &&
      typeof o.placeName === "string" &&
      typeof o.neighbourhood === "string" &&
      typeof o.reason === "string" &&
      typeof o.walkingMinutesToNext === "number"
    );
  });
};

const MOODS = new Set(["foodie", "culture", "slow", "buzzy", "photographer"]);

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const limited = await enforceRateLimit("generate-plan", auth.userId, corsHeaders);
    if (limited instanceof Response) return limited;
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);
    const city = String(body.city ?? "").trim();
    const timeBudget = Number(body.timeBudget);
    const mood = String(body.mood ?? "");
    if (!city || city.length > 80) return json({ error: "Invalid city" }, 400);
    if (!Number.isFinite(timeBudget) || timeBudget < 1 || timeBudget > 14) {
      return json({ error: "Invalid timeBudget" }, 400);
    }
    if (!MOODS.has(mood)) return json({ error: "Invalid mood" }, 400);

    const key = Deno.env.get("DEEPSEEK_API_KEY");
    if (!key) {
      console.error("DEEPSEEK_API_KEY missing");
      return json({ error: "generation_failed" }, 500);
    }

    const userMsg = `City: ${city}\nTime budget: ${timeBudget} hours\nMood: ${mood}`;
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 1800,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("DeepSeek error:", res.status, txt);
      return json({ error: "generation_failed" }, 500);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("plan parse failed:", e, content.slice(0, 200));
      return json({ error: "generation_failed" }, 500);
    }
    if (!isValidPlan(parsed)) {
      console.error("plan invalid shape:", content.slice(0, 200));
      return json({ error: "generation_failed" }, 500);
    }

    return json({ plan: parsed });
  } catch (e) {
    console.error("generate-plan error:", e);
    return json({ error: "generation_failed" }, 500);
  }
}));
