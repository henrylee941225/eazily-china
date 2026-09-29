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

// In-memory cache: key -> public URL. Lives for the function instance lifetime.
const cache = new Map<string, string>();

function buildPrompt(title: string, city: string, tag: string, blurb: string) {
  return `A high-quality, realistic editorial travel photograph of "${title}" in ${city}, China. Context: ${tag}. ${blurb}.
Cinematic lighting, natural colours, shallow depth of field, no text, no watermark, no logos, no people's faces in focus, 16:10 landscape framing, magazine-quality.`;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL from image gateway");
  const contentType = m[1] || "image/png";
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, contentType };
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit("pick-image", auth.userId, corsHeaders);
  if (limited instanceof Response) return limited;

  try {
    const { title, city, tag, blurb } = await req.json();
    if (!title || !city) {
      return new Response(JSON.stringify({ error: "Missing 'title' or 'city'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const titleStr = String(title).slice(0, 120);
    const cityStr = String(city).slice(0, 80);
    const tagStr = tag != null ? String(tag).slice(0, 60) : "";
    const blurbStr = blurb != null ? String(blurb).slice(0, 300) : "";

    const cityKey = cityStr.toLowerCase();
    const titleKey = titleStr.toLowerCase();
    const cacheKey = `${cityKey}|${titleKey}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify({ image: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("Supabase env missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const objectPath = `${slug(cityStr)}/${slug(titleStr)}.png`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/pick-images/${objectPath}`;

    // If the object already exists in storage, reuse it.
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      cache.set(cacheKey, publicUrl);
      return new Response(JSON.stringify({ image: publicUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try up to 2 times — the image model occasionally returns no image.
    let dataUrl: string | undefined;
    let lastErr = "";
    for (let attempt = 0; attempt < 2 && !dataUrl; attempt++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          modalities: ["image", "text"],
          messages: [
            { role: "user", content: buildPrompt(titleStr, cityStr, tagStr, blurbStr) },
          ],
        }),
      });

      if (!resp.ok) {
        lastErr = await resp.text();
        console.error("Image gateway error", resp.status, lastErr);
        continue;
      }
      const data = await resp.json();
      dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    }

    if (!dataUrl) {
      // Graceful fallback: return 200 with no image so the client uses its placeholder.
      console.warn("No image returned after retries", lastErr);
      return new Response(
        JSON.stringify({ image: null, fallback: true, error: "No image returned" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { bytes, contentType } = dataUrlToBytes(dataUrl);
    const { error: upErr } = await admin.storage
      .from("pick-images")
      .upload(objectPath, bytes, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) {
      console.error("storage upload error", upErr);
      throw new Error("Storage upload failed");
    }

    cache.set(cacheKey, publicUrl);
    return new Response(JSON.stringify({ image: publicUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pick-image error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
