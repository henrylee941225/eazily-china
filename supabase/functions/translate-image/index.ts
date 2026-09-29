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

const LANG_NAMES: Record<string, string> = {
  en: "English", de: "German", fra: "French", it: "Italian",
  nl: "Dutch", pt: "Portuguese", spa: "Spanish", zh: "Chinese (Simplified)",
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit("translate-image", auth.userId, corsHeaders);
  if (limited instanceof Response) return limited;

  try {
    const { image, from = "auto", to = "zh" } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return json({ error: "Missing or invalid image (expect data URL)" }, 400);
    }
    if (image.length > 8_000_000) return json({ error: "Image too large (max ~6MB)" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "Service unavailable" }, 503);

    const targetName = LANG_NAMES[to] ?? "Chinese (Simplified)";
    const sourceHint = from === "auto"
      ? "Detect the source language automatically."
      : `The text is in ${LANG_NAMES[from] ?? from}.`;

    const prompt = `You are a translator for a tourist in China. Look at this photo and:
1. Extract ALL visible text (signs, menus, labels, packaging, etc.).
2. ${sourceHint} Translate the extracted text into ${targetName}.
3. If translating into Chinese, also provide Hanyu Pinyin with tone marks for the translation.

Return ONLY a JSON object, no markdown fences, with this exact shape:
{"source":"<original text on one line, joined with ' / ' if multiple>","translated":"<translation>","pinyin":"<pinyin or empty string>"}
If you cannot find any text, return {"source":"","translated":"","pinyin":""}.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000);
    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("AI gateway fetch failed/timeout", e);
      return json({ error: "AI gateway timeout" }, 504);
    }
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) return json({ error: "Too many requests" }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { source?: string; translated?: string; pinyin?: string } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
      }
    }

    return json({
      source: String(parsed.source ?? ""),
      translated: String(parsed.translated ?? ""),
      pinyin: String(parsed.pinyin ?? ""),
    });
  } catch (e) {
    console.error("translate-image error:", e);
    return json({ error: "Internal server error" }, 500);
  }
}));
