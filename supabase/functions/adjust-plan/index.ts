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

type Plan = {
  title: string;
  totalHours: number;
  totalDistanceKm: number;
  stops: Stop[];
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

const isValidPlan = (x: unknown): x is Plan => {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  if (typeof p.title !== "string") return false;
  if (!Array.isArray(p.stops)) return false;
  return p.stops.every(isValidStop);
};

const SYSTEM_PROMPT = `You are eazilyChina's day-planner AI. The traveller already has a day plan and has sent a short instruction (e.g. "start later and skip the museum", "add a coffee stop", "swap lunch for something Cantonese"). Return the MODIFIED plan.

Rules — non-negotiable:
- Preserve as much of the existing plan as possible; only change what the user asked for.
- Time shifts, removals and reorders are ALWAYS allowed.
- If you need to ADD a NEW venue, you may ONLY choose from the "curatedVenues" list provided. Use the venue's placeName verbatim (English name, and Chinese name where the list includes one — join with a space). Never invent a venue not in that list. If nothing in the list fits, prefer not adding a new stop rather than inventing one.
- Any stop already in the current plan may be kept even if it isn't in curatedVenues.
- Rechain startTimes so they flow (HH:MM 24-hour). walkingMinutesToNext is an integer 0–60; use 0 for the last stop.
- durationMinutes is an integer 15–240.
- Also return a short one-sentence "summary" of what changed in UK English, ≤120 chars, no emoji. Example: "Updated: 10:00 start, removed the museum, added a café stop."

Output: JSON only, no markdown, no preamble. Shape:
{
  "summary": "…",
  "plan": {
    "title": "…",
    "totalHours": 6,
    "totalDistanceKm": 3.2,
    "stops": [ { "startTime":"10:00","durationMinutes":60,"placeName":"…","neighbourhood":"…","reason":"…","walkingMinutesToNext":10 } ]
  }
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
    const message = String(body.message ?? "").trim();
    const currentPlan = body.currentPlan;
    const curatedVenuesRaw = Array.isArray(body.curatedVenues) ? body.curatedVenues : [];

    if (!city || city.length > 80) return json({ error: "Invalid city" }, 400);
    if (!message || message.length > 500) return json({ error: "Invalid message" }, 400);
    if (!isValidPlan(currentPlan)) return json({ error: "Invalid currentPlan" }, 400);

    // Normalise curated pool — a flat list of allowed placeName strings.
    const curated: { placeName: string; district?: string; category?: string }[] = [];
    for (const raw of curatedVenuesRaw.slice(0, 200)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!name) continue;
      const zh = typeof r.name_zh === "string" ? r.name_zh.trim() : "";
      const placeName = zh && zh.toLowerCase() !== name.toLowerCase() ? `${name} ${zh}` : name;
      curated.push({
        placeName,
        district: typeof r.district === "string" ? r.district : undefined,
        category: typeof r.category === "string" ? r.category : undefined,
      });
    }

    const key = Deno.env.get("DEEPSEEK_API_KEY");
    if (!key) {
      console.error("DEEPSEEK_API_KEY missing");
      return json({ error: "adjust_failed" }, 500);
    }

    const userPayload = JSON.stringify({
      city,
      userInstruction: message,
      currentPlan,
      curatedVenues: curated,
    });

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("adjust-plan upstream error:", res.status, t);
      return json({ error: "adjust_failed" }, 500);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    let parsed: { summary?: unknown; plan?: unknown } | null = null;
    try { parsed = JSON.parse(content); } catch (e) {
      console.error("adjust parse failed:", e, content.slice(0, 200));
      return json({ error: "adjust_failed" }, 500);
    }
    if (!isValidPlan(parsed?.plan)) {
      console.error("adjust invalid plan shape:", content.slice(0, 200));
      return json({ error: "adjust_failed" }, 500);
    }

    // Server-side grounding: drop any NEW stop whose placeName isn't in the
    // current plan or the curated list. Existing stops are always allowed.
    const norm = (s: string) => s.toLowerCase().trim();
    const existingNames = new Set(
      (currentPlan as Plan).stops.map((s) => norm(s.placeName)),
    );
    const curatedNames = new Set(curated.map((c) => norm(c.placeName)));
    // Also allow the English portion of a curated "Name 中文" pair, in case
    // the model returns the English name only.
    for (const c of curated) {
      const head = c.placeName.split(/\s+/)[0];
      if (head) curatedNames.add(norm(head));
    }

    const filteredStops = (parsed!.plan as Plan).stops.filter((s) => {
      const n = norm(s.placeName);
      if (existingNames.has(n)) return true;
      if (curatedNames.has(n)) return true;
      // Also accept if the first token matches an existing/curated name.
      const head = norm(s.placeName.split(/\s+/)[0]);
      if (existingNames.has(head) || curatedNames.has(head)) return true;
      console.warn("adjust-plan: dropping ungrounded stop:", s.placeName);
      return false;
    });

    if (filteredStops.length === 0) {
      return json({ error: "adjust_failed", detail: "No grounded stops after filtering" }, 500);
    }

    const outPlan: Plan = {
      ...(parsed!.plan as Plan),
      stops: filteredStops,
    };

    const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
      ? String(parsed.summary).trim().slice(0, 200)
      : "Updated your day.";

    return json({ plan: outPlan, summary });
  } catch (e) {
    console.error("adjust-plan error:", e);
    return json({ error: "adjust_failed" }, 500);
  }
}));
