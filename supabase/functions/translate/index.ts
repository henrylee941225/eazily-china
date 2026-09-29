// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "node:crypto";

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

const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

// Baidu Translate — https://fanyi-api.baidu.com/doc/21
// Accepts any Baidu language code (en, jp, kor, fra, spa, de, it, ru, pt, ara, th, vie, zh, ...).
async function baiduTranslate(
  text: string,
  from: string,
  to: string,
): Promise<{ translated: string }> {
  const appid = Deno.env.get("BAIDU_TRANSLATE_APP_ID");
  const secret = Deno.env.get("BAIDU_TRANSLATE_SECRET");
  if (!appid || !secret) throw new Error("Baidu Translate not configured");

  const salt = Date.now().toString();
  const sign = md5(appid + text + salt + secret);
  const params = new URLSearchParams({
    q: text,
    from,
    to,
    appid,
    salt,
    sign,
  });

  const res = await fetch(
    "https://fanyi-api.baidu.com/api/trans/vip/translate",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  if (!res.ok) throw new Error(`Baidu HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error_code) {
    const code = String(data.error_code);
    console.error("baidu upstream error", code, data?.error_msg);
    const err = new Error(`Baidu ${code}: ${data.error_msg}`) as Error & { baiduCode?: string };
    err.baiduCode = code;
    throw err;
  }

  const translated = (data?.trans_result ?? [])
    .map((r: { dst: string }) => r.dst)
    .join("\n");
  return { translated };
}

// DeepSeek — used only to add Hanyu Pinyin to a Chinese string.
async function pinyinFor(zh: string): Promise<string> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key || !zh) return "";
  try {
    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "Return ONLY Hanyu Pinyin with tone marks for the user's Chinese text. No translation, no punctuation commentary, no quotes.",
          },
          { role: "user", content: zh },
        ],
        temperature: 0,
      }),
    });
    if (!r.ok) return "";
    const d = await r.json();
    return String(d?.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

// Baidu Translate's full documented supported-language set (200 languages) plus
// "auto" for source detection. Baidu codes, not ISO — see https://fanyi-api.baidu.com/doc/21
const BAIDU_LANGS = new Set([
  "auto",
  "zh","cht","yue","wyw","en","jp","kor","fra","frn","frm","spa","th","ara","arq","tua","ru",
  "pt","pot","de","log","it","el","gra","nl","pl","bul","est","dan","fin","cs","rom","slo","sk",
  "swe","hu","vie","tr","ukr","bel","hrv","srp","src","bos","mot","mac","alb","lav","lit","lag",
  "ice","fao","nor","nob","nno","gle","gla","wel","cor","bre","glv","cat","baq","glg","ast",
  "arg","oci","wln","srd","cos","nea","fri","roh","lim","fry","ltz","lat","eno","sil","kah",
  "ups","los","ruy","ro","chv","bak","tat","cri","aze","kir","tuk","hi","urd","ben","pan","guj",
  "mar","nep","sin","tam","tel","kan","mal","ori","asm","snd","kas","san","mai","bho","kok",
  "div","per","pus","kur","bal","ir","oss","tgk","arm","geo","heb","yid","syr","amh","tir",
  "bli","orm","som","swa","afr","xho","zul","sot","ped","nbl","tso","ven","sna","nya","bem",
  "lug","kin","lin","kon","ful","hau","ibo","yor","twi","aka","wol","kau","kab","ber","sol",
  "nqo","mg","mau","ht","pap","may","id","jav","sun","ach","fil","tgl","ceb","hil","pam","bur",
  "hkm","lao","sha","hak","hmn","tet","bis","mah","sm","mao","haw","grn","aym","que","chr",
  "cre","oji","hup","iku","kal","sme","ing","zaz","epo","ido","ina","loj","kli","mlt",
]);
const MAX_TEXT_LEN = 2000;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit("translate", auth.userId, corsHeaders);
  if (limited instanceof Response) return limited;

  try {
    const { text, from = "en", to = "zh" } = await req.json();
    if (!text || typeof text !== "string") return json({ error: "Missing text" }, 400);
    if (text.length > MAX_TEXT_LEN) return json({ error: `Text exceeds ${MAX_TEXT_LEN} characters` }, 400);
    const fromCode = String(from);
    const toCode = String(to);
    if (!BAIDU_LANGS.has(fromCode) || !BAIDU_LANGS.has(toCode)) {
      return json({ error: "Unsupported language code" }, 400);
    }

    const { translated } = await baiduTranslate(text, fromCode, toCode);
    const pinyin = toCode === "zh" ? await pinyinFor(translated) : "";

    return json({ translated, pinyin });
  } catch (e) {
    const code = (e as { baiduCode?: string })?.baiduCode;
    console.error("translate error:", code ?? "", e);
    // 58001 = unsupported language pair on our Baidu account tier.
    if (code === "58001") {
      return json({ error: "This language pair isn't available", code }, 400);
    }
    return json({ error: "Internal server error" }, 500);
  }

}));
