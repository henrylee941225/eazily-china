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

const SYSTEM_PROMPT = `You are a practical day planner for first-time foreign travellers in China. The user wants to ADD a new stop into an existing plan, after a specific position.

Rules:
- Suggest a real, well-known, publicly accessible place
- Must match the trip's mood faithfully
- Must fit the time of day at that position in the plan
- Must be geographically coherent with the surrounding stops (short walk preferred)
- Do NOT suggest any place already in the plan
- Compute startTime based on the previous stop's startTime + its duration + walking time (or pick a sensible time if inserting at the start)
- Compute walkingMinutesToNext to the following stop (0 if appended at the end)

Output: JSON only, no markdown, no preamble. Return a single stop object:
{
  "startTime": "10:30",
  "durationMinutes": 60,
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
    const insertAfterIndex = Number(body.insertAfterIndex);

    if (!city || city.length > 80) return json({ error: "Invalid city" }, 400);
    if (!Number.isFinite(timeBudget) || timeBudget < 1 || timeBudget > 14)
      return json({ error: "Invalid timeBudget" }, 400);
    if (!MOODS.has(mood)) return json({ error: "Invalid mood" }, 400);
    if (!currentPlan || !Array.isArray(currentPlan.stops))
      return json({ error: "Invalid currentPlan" }, 400);
    if (
      !Number.isInteger(insertAfterIndex) ||
      insertAfterIndex < -1 ||
      insertAfterIndex >= currentPlan.stops.length
    ) {
      return json({ error: "Invalid insertAfterIndex" }, 400);
    }

    const key = Deno.env.get("DEEPSEEK_API_KEY");
    if (!key) {
      console.error("DEEPSEEK_API_KEY missing");
      return json({ error: "add_failed" }, 500);
    }

    const prev = insertAfterIndex >= 0 ? currentPlan.stops[insertAfterIndex] : null;
    const next =
      insertAfterIndex + 1 < currentPlan.stops.length
        ? currentPlan.stops[insertAfterIndex + 1]
        : null;

    const excluded = currentPlan.stops.map((s: Stop) => s.placeName).filter(Boolean);

    const userMsg = `City: ${city}
Time budget: ${timeBudget} hours
Mood: ${mood}

Current plan stops (in order):
${currentPlan.stops
  .map(
    (s: Stop, i: number) =>
      `${i + 1}. ${s.startTime} · ${s.placeName} (${s.neighbourhood}) · ${s.durationMinutes} min`,
  )
  .join("\n") || "(empty plan)"}

Insert a new stop AFTER position ${insertAfterIndex + 1}.
${prev ? `Previous stop: "${prev.placeName}" (${prev.neighbourhood}) ends around ${prev.startTime} + ${prev.durationMinutes} min.` : "This stop will be the FIRST stop of the day."}
${next ? `Following stop: "${next.placeName}" (${next.neighbourhood}) starts at ${next.startTime}.` : "This stop will be the LAST stop of the day — set walkingMinutesToNext to 0."}

Do not suggest any of these already-in-plan places:
${excluded.map((p: string) => `- ${p}`).join("\n") || "(none)"}`;

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
      console.error("DeepSeek add error:", res.status, txt);
      return json({ error: "add_failed" }, 500);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("add parse failed:", e, content.slice(0, 200));
      return json({ error: "add_failed" }, 500);
    }
    if (!isValidStop(parsed)) {
      console.error("add invalid shape:", content.slice(0, 200));
      return json({ error: "add_failed" }, 500);
    }

    return json({ stop: parsed });
  } catch (e) {
    console.error("add-stop error:", e);
    return json({ error: "add_failed" }, 500);
  }
}));
