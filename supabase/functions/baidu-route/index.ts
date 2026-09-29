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

type Mode = "driving" | "walking" | "transit";

// Baidu Direction API v2 (BD-09 coordinates, "lat,lng" order)
const ENDPOINT: Record<Mode, string> = {
  driving: "https://api.map.baidu.com/directionlite/v1/driving",
  walking: "https://api.map.baidu.com/directionlite/v1/walking",
  transit: "https://api.map.baidu.com/directionlite/v1/transit",
};

type Step = { instruction: string; distance_m: number; duration_s?: number };

// Strip Baidu's HTML markup from instructions before translating.
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function translateSteps(zh: string[]): Promise<string[]> {
  if (!zh.length) return zh;
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return zh;
  try {
    const prompt = `Translate each Chinese navigation instruction below into clear, concise English a Western tourist can follow. Keep road / station / landmark names romanised (pinyin) where helpful. Return STRICT JSON: {"steps":["...","..."]} with the same number of items, in the same order.

Chinese instructions:
${zh.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You translate Chinese turn-by-turn navigation into English for tourists. Output strict JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!r.ok) return zh;
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const out = Array.isArray(parsed?.steps) ? parsed.steps.map((s: unknown) => String(s ?? "")) : [];
    if (out.length === zh.length) return out;
    return zh;
  } catch (e) {
    console.warn("step translate failed", e);
    return zh;
  }
}

// Decode Baidu's path string. Baidu returns either:
//  - a polyline-style string (encoded), or for directionlite, an array of "lng,lat;lng,lat" segments per step.
const parsePathString = (s: string): [number, number][] => {
  // "lng,lat;lng,lat;..."
  return s.split(";").filter(Boolean).map((p) => {
    const [lng, lat] = p.split(",").map(Number);
    return [lng, lat] as [number, number];
  });
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;

  try {
    const { origin, destination, mode = "driving" } = await req.json();
    if (!origin || !destination) return json({ error: "origin and destination required" }, 400);

    const ak = Deno.env.get("BAIDU_MAP_AK");
    if (!ak) return json({ error: "BAIDU_MAP_AK not configured" }, 500);

    const m = (mode as Mode) in ENDPOINT ? (mode as Mode) : "driving";
    const url = new URL(ENDPOINT[m]);
    // Baidu expects "lat,lng"
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("ak", ak);
    url.searchParams.set("coord_type", "bd09ll");
    url.searchParams.set("ret_coordtype", "bd09ll");

    const r = await fetch(url.toString());
    const data = await r.json();

    if (data?.status !== 0) {
      return json({ error: data?.message ?? "Baidu routing failed", code: data?.status }, 502);
    }

    const route = data?.result?.routes?.[0];
    if (!route) return json({ error: "No route returned" }, 404);

    const points: [number, number][] = [];
    const rawSteps: Step[] = [];

    for (const step of route.steps ?? []) {
      // transit returns nested vehicle/walk arrays; flatten
      const segs = Array.isArray(step) ? step : [step];
      for (const s of segs) {
        if (typeof s.path === "string") points.push(...parsePathString(s.path));
        const ins =
          s.instruction ||
          s.instructions ||
          (s.vehicle_info?.detail?.bus?.name
            ? `乘坐${s.vehicle_info.detail.bus.name}，从${s.start_location?.name ?? ""}到${s.end_location?.name ?? ""}`
            : "");
        if (ins) {
          rawSteps.push({
            instruction: stripHtml(String(ins)),
            distance_m: Number(s.distance ?? 0),
            duration_s: Number(s.duration ?? 0),
          });
        }
      }
    }

    const translated = await translateSteps(rawSteps.map((s) => s.instruction));
    const steps = rawSteps.map((s, i) => ({ ...s, instruction: translated[i] }));

    return json({
      mode: m,
      distance_m: Number(route.distance ?? 0),
      duration_s: Number(route.duration ?? 0),
      points,
      steps,
    });
  } catch (e) {
    console.error("baidu-route error:", e);
    return json({ error: "Internal server error" }, 500);
  }
}));
