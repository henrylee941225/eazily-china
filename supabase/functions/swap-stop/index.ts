import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
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

type Stop = {
  startTime: string;
  durationMinutes: number;
  placeName: string;
  neighbourhood: string;
  reason: string;
  walkingMinutesToNext: number;
};

const isValidStop = (x: unknown): x is Stop => {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.startTime === "string" &&
    typeof o.durationMinutes === "number" &&
    typeof o.placeName === "string" &&
    typeof o.neighbourhood === "string" &&
    typeof o.reason === "string" &&
    typeof o.walkingMinutesToNext === "number"
  );
};

const MOODS = new Set(["foodie", "culture", "slow", "buzzy", "photographer"]);

const SYSTEM_PROMPT = `You are a practical day planner for first-time foreign travellers in China. The user has a generated plan and wants to replace ONE stop with an alternative.

Rules:
- Suggest a real, well-known, publicly accessible place
- Match the trip's mood faithfully
- Keep duration similar to the stop being replaced (±20 min)
- Prefer the same neighbourhood or a short walk away
- Do NOT suggest any place listed in the "do not suggest" list
- Keep startTime the same as the replaced stop
- Recompute walkingMinutesToNext for the new place (0 if it's the last stop)

Output: JSON only, no markdown, no preamble. Return a single stop object:
{
  "startTime": "10:30",
  "durationMinutes": 90,
  "placeName": "Place Name",
  "neighbourhood": "Neighbourhood · District",
  "reason": "Short reason",
  "walkingMinutesToNext": 10
}`;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON" }, 400);

    const city = String(body.city ?? "").trim();
    const timeBudget = Number(body.timeBudget);
    const mood = String(body.mood ?? "");
    const currentPlan = body.currentPlan;
    const stopIndexToReplace = Number(body.stopIndexToReplace);
    const previouslyShownAlternatives = Array.isArray(body.previouslyShownAlternatives)
      ? body.previouslyShownAlternatives.map((s: unknown) => String(s)).slice(0, 50)
      : [];

    if (!city || city.length > 80) return json({ error: "Invalid city" }, 400);
    if (!Number.isFinite(timeBudget) || timeBudget < 1 || timeBudget > 14)
      return json({ error: "Invalid timeBudget" }, 400);
    if (!MOODS.has(mood)) return json({ error: "Invalid mood" }, 400);
    if (!currentPlan || !Array.isArray(currentPlan.stops))
      return json({ error: "Invalid currentPlan" }, 400);
    if (
      !Number.isInteger(stopIndexToReplace) ||
      stopIndexToReplace < 0 ||
      stopIndexToReplace >= currentPlan.stops.length
    ) {
      return json({ error: "Invalid stopIndexToReplace" }, 400);
    }

    const key = Deno.env.get("DEEPSEEK_API_KEY");
    if (!key) {
      console.error("DEEPSEEK_API_KEY missing");
      return json({ error: "swap_failed" }, 500);
    }

    const stopToReplace = currentPlan.stops[stopIndexToReplace];
    const isLast = stopIndexToReplace === currentPlan.stops.length - 1;
    const excluded = Array.from(
      new Set(
        [
          stopToReplace.placeName,
          ...previouslyShownAlternatives,
          ...currentPlan.stops.map((s: Stop) => s.placeName),
        ].filter(Boolean),
      ),
    );

    const userMsg = `City: ${city}
Time budget: ${timeBudget} hours
Mood: ${mood}

Current plan stops (in order):
${currentPlan.stops
  .map(
    (s: Stop, i: number) =>
      `${i + 1}. ${s.startTime} · ${s.placeName} (${s.neighbourhood}) · ${s.durationMinutes} min`,
  )
  .join("\n")}

Replace stop #${stopIndexToReplace + 1} ("${stopToReplace.placeName}").
This stop ${isLast ? "is the LAST stop — set walkingMinutesToNext to 0." : `is followed by "${currentPlan.stops[stopIndexToReplace + 1].placeName}" in ${currentPlan.stops[stopIndexToReplace + 1].neighbourhood}.`}

Do not suggest any of these previously-shown or already-in-plan places:
${excluded.map((p) => `- ${p}`).join("\n")}`;

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
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("DeepSeek swap error:", res.status, txt);
      return json({ error: "swap_failed" }, 500);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("swap parse failed:", e, content.slice(0, 200));
      return json({ error: "swap_failed" }, 500);
    }
    if (!isValidStop(parsed)) {
      console.error("swap invalid shape:", content.slice(0, 200));
      return json({ error: "swap_failed" }, 500);
    }

    return json({ stop: parsed });
  } catch (e) {
    console.error("swap-stop error:", e);
    return json({ error: "swap_failed" }, 500);
  }
}));
