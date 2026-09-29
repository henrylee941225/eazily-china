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

const ENDPOINT: Record<Mode, string> = {
  driving: "https://restapi.amap.com/v3/direction/driving",
  walking: "https://restapi.amap.com/v3/direction/walking",
  transit: "https://restapi.amap.com/v3/direction/transit/integrated",
};

const decode = (s: string): [number, number][] =>
  s.split(";").filter(Boolean).map((p) => {
    const [lng, lat] = p.split(",").map(Number);
    return [lng, lat] as [number, number];
  });

type Step = {
  instruction: string;
  distance_m: number;
  duration_s?: number;
  // Per-step polyline as [lng, lat] tuples (GCJ-02). Empty when AMap does
  // not expose a polyline for the sub-step (e.g. some transit sub-steps).
  points: [number, number][];
};

// Translate Chinese turn-by-turn instructions to English via Lovable AI.
// Falls back to original strings on any failure.
async function translateSteps(zh: string[]): Promise<string[]> {
  if (!zh.length) return zh;
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return zh;
  try {
    const prompt = `Translate each Chinese navigation instruction below into clear, concise English a Western tourist can follow. Keep road / station / landmark names romanised (pinyin) where helpful. Return STRICT JSON: {"steps":["...","..."]} with the same number of items, in the same order, no extra commentary.

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

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;

  try {
    const { origin, destination, mode = "driving", city = "010" } = await req.json();
    if (!origin || !destination) return json({ error: "origin and destination required" }, 400);

    const key =
      Deno.env.get("AMAP_WEB_SERVICE_KEY") ?? Deno.env.get("AMAP_JS_KEY");
    if (!key) return json({ error: "AMAP_WEB_SERVICE_KEY not configured" }, 500);

    const m = (mode as Mode) in ENDPOINT ? (mode as Mode) : "driving";
    const url = new URL(ENDPOINT[m]);
    url.searchParams.set("key", key);
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    if (m === "transit") url.searchParams.set("city", city);
    url.searchParams.set("output", "json");

    const r = await fetch(url.toString());
    const data = await r.json();

    if (data?.status !== "1") {
      return json({ error: data?.info ?? "AMap routing failed", code: data?.infocode }, 502);
    }

    const path = data?.route?.paths?.[0];
    if (!path) {
      const transit = data?.route?.transits?.[0];
      if (transit) {
        const points: [number, number][] = [];
        const rawSteps: Step[] = [];
        for (const seg of transit.segments ?? []) {
          const walkPoly = seg.walking?.polyline as string | undefined;
          const busPoly = seg.bus?.buslines?.[0]?.polyline as string | undefined;
          const walkPts = walkPoly ? decode(walkPoly) : [];
          const busPts = busPoly ? decode(busPoly) : [];
          if (walkPts.length) points.push(...walkPts);
          if (busPts.length) points.push(...busPts);
          if (seg.walking) {
            const walkInstr = (seg.walking.steps ?? [])
              .map((ws: { instruction?: string }) => String(ws.instruction ?? ""))
              .filter(Boolean)
              .join(" · ");
            const walkDist = Number(seg.walking.distance ?? 0);
            if (walkInstr || walkPts.length) {
              rawSteps.push({
                instruction: walkInstr || "步行",
                distance_m: walkDist,
                points: walkPts,
              });
            }
          }
          const bus = seg.bus?.buslines?.[0];
          if (bus) {
            const name = bus.name ?? "公交";
            const onStop = bus.departure_stop?.name ?? "";
            const offStop = bus.arrival_stop?.name ?? "";
            const stops = bus.via_num != null ? `（共${Number(bus.via_num) + 1}站）` : "";
            rawSteps.push({
              instruction: `乘坐${name}，从${onStop}上车，到${offStop}下车${stops}`,
              distance_m: Number(bus.distance ?? 0),
              duration_s: Number(bus.duration ?? 0),
              points: busPts,
            });
          }
        }
        const translated = await translateSteps(rawSteps.map((s) => s.instruction));
        const steps = rawSteps.map((s, i) => ({ ...s, instruction: translated[i] }));
        return json({
          mode: m,
          distance_m: Number(transit.distance ?? 0),
          duration_s: Number(transit.duration ?? 0),
          cost: transit.cost ?? null,
          points,
          steps,
        });
      }
      return json({ error: "No route found" }, 404);
    }

    const points: [number, number][] = [];
    const rawSteps: Step[] = [];
    for (const step of path.steps ?? []) {
      const stepPts = step.polyline ? decode(step.polyline) : [];
      if (stepPts.length) points.push(...stepPts);
      if (step.instruction || stepPts.length) {
        rawSteps.push({
          instruction: String(step.instruction ?? ""),
          distance_m: Number(step.distance ?? 0),
          duration_s: Number(step.duration ?? 0),
          points: stepPts,
        });
      }
    }
    const translated = await translateSteps(rawSteps.map((s) => s.instruction));
    const steps = rawSteps.map((s, i) => ({ ...s, instruction: translated[i] }));

    return json({
      mode: m,
      distance_m: Number(path.distance ?? 0),
      duration_s: Number(path.duration ?? 0),
      points,
      steps,
    });
  } catch (e) {
    console.error("amap-route error:", e);
    return json({ error: "Internal server error" }, 500);
  }
}));
