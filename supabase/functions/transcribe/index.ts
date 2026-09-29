// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
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

// Provider (gpt-4o-mini-transcribe) expects bare ISO-639-1 codes. Our app uses
// Baidu codes, so translate them here. Only Baidu languages whose ISO-639-1 code
// is in the model's 98-language set appear below; anything missing is marked
// supportsSpeech: false client-side, so no invalid code is ever sent.
const ISO: Record<string, string> = {
  zh: "zh",
  cht: "zh",
  yue: "yue", // probe confirmed the transcription model accepts "yue" directly
  en: "en",
  jp: "ja",
  kor: "ko",
  fra: "fr",
  frn: "fr",
  spa: "es",
  th: "th",
  ara: "ar",
  arq: "ar",
  tua: "ar",
  ru: "ru",
  pt: "pt",
  pot: "pt",
  de: "de",
  it: "it",
  el: "el",
  nl: "nl",
  pl: "pl",
  bul: "bg",
  est: "et",
  dan: "da",
  fin: "fi",
  cs: "cs",
  rom: "ro",
  slo: "sl",
  sk: "sk",
  swe: "sv",
  hu: "hu",
  vie: "vi",
  tr: "tr",
  ukr: "uk",
  bel: "be",
  hrv: "hr",
  srp: "sr",
  src: "sr",
  bos: "bs",
  mot: "sr",
  mac: "mk",
  alb: "sq",
  lav: "lv",
  lit: "lt",
  ice: "is",
  fao: "fo",
  nor: "no",
  nob: "no",
  nno: "nn",
  wel: "cy",
  bre: "br",
  cat: "ca",
  baq: "eu",
  glg: "gl",
  oci: "oc",
  ltz: "lb",
  lat: "la",
  bak: "ba",
  tat: "tt",
  aze: "az",
  tuk: "tk",
  hi: "hi",
  urd: "ur",
  ben: "bn",
  pan: "pa",
  guj: "gu",
  mar: "mr",
  nep: "ne",
  sin: "si",
  tam: "ta",
  tel: "te",
  kan: "kn",
  mal: "ml",
  asm: "as",
  snd: "sd",
  san: "sa",
  per: "fa",
  pus: "ps",
  tgk: "tg",
  arm: "hy",
  geo: "ka",
  heb: "he",
  yid: "yi",
  amh: "am",
  som: "so",
  swa: "sw",
  afr: "af",
  sna: "sn",
  lin: "ln",
  hau: "ha",
  yor: "yo",
  mg: "mg",
  ht: "ht",
  may: "ms",
  id: "id",
  jav: "jv",
  sun: "su",
  fil: "tl",
  tgl: "tl",
  bur: "my",
  hkm: "km",
  lao: "lo",
  mao: "mi",
  mlt: "mt",
};

const MAX_BYTES = 20 * 1024 * 1024;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit("transcribe", auth.userId, corsHeaders);
  if (limited instanceof Response) return limited;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Transcription not configured" }, 500);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return json({ error: "No audio received" }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: "Recording too long" }, 413);
    }
    if (file.size < 2048) {
      return json({ error: "Recording was empty", text: "" }, 400);
    }

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", file, "recording.wav");
    const lang = String(form.get("language") ?? "");
    const iso = ISO[lang];
    if (iso) upstream.append("language", iso);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("transcribe upstream error", res.status, detail);
      return json({ error: `Transcription failed (${res.status})` }, res.status);
    }

    const data = await res.json();
    return json({ text: String(data?.text ?? "").trim() });
  } catch (err) {
    console.error("transcribe failed", err);
    return json({ error: "Transcription failed" }, 500);
  }
}));
