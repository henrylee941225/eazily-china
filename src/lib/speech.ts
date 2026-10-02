// Shared Web Speech path for browser playback. Native Camera playback uses the
// platform speech engine so it can manage the iOS audio session explicitly.

export type SpeechLang = "zh" | "en" | "cht" | "yue" | "ja" | "ko";

export const BCP47: Record<SpeechLang, string> = {
  zh: "zh-CN",
  cht: "zh-TW",
  yue: "zh-HK",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
};

// Deterministic named-voice preference per language family. Ordered from most
// natural-sounding (Apple neural) down to generic fallbacks. Kept identical to
// the original Quick phrases resolution so that surface's Chinese voice is the
// reference for every other surface.
const preferenceFor = (prefix: string, bcp47: string): RegExp[] => {
  if (prefix === "zh") {
    return [
      /Tingting/i, /Sinji/i, /Meijia/i, /Yaoyao/i, /Xiaoxiao/i,
      /Google\s.*Chinese/i, /Microsoft\s.*(Xiaoxiao|Yunyang|Yunxi)/i,
      new RegExp("^" + bcp47, "i"), /Chinese/i,
    ];
  }
  if (prefix === "ja") return [/Kyoko/i, /O-ren/i, /Google\s.*Japanese/i, /^ja-JP/i, /Japanese/i];
  if (prefix === "ko") return [/Yuna/i, /Google\s.*Korean/i, /^ko-KR/i, /Korean/i];
  if (prefix === "en") {
    return [
      /Samantha/i, /Karen/i, /Daniel/i, /Google\sUS English/i,
      /Microsoft\s.*(Aria|Jenny|Guy)/i, /^en-US/i, /English/i,
    ];
  }
  return [];
};

// Cache the resolved voice per locale for the session so every call site hits
// the same SpeechSynthesisVoice instance — no drift between surfaces.
const voiceCache = new Map<string, SpeechSynthesisVoice | null>();

const preferLocal = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) =>
  (b.localService ? 1 : 0) - (a.localService ? 1 : 0);

const resolveVoice = (bcp47: string): SpeechSynthesisVoice | null => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const key = bcp47.toLowerCase();
  const cached = voiceCache.get(key);
  if (cached !== undefined) return cached;
  const voices = speechSynthesis.getVoices();
  // Don't cache when the list hasn't loaded yet (common on first render in iOS
  // webviews) — resolve again next call.
  if (!voices.length) return null;
  const prefix = key.split("-")[0];
  const prefer = preferenceFor(prefix, bcp47);
  for (const re of prefer) {
    const matches = voices.filter((v) => re.test(v.name) || re.test(v.lang));
    if (matches.length) {
      matches.sort(preferLocal);
      voiceCache.set(key, matches[0]);
      return matches[0];
    }
  }
  const exact = voices.filter((v) => v.lang?.toLowerCase() === key).sort(preferLocal);
  if (exact[0]) { voiceCache.set(key, exact[0]); return exact[0]; }
  const langMatch = voices
    .filter((v) => v.lang?.toLowerCase().startsWith(prefix))
    .sort(preferLocal);
  if (langMatch[0]) { voiceCache.set(key, langMatch[0]); return langMatch[0]; }
  voiceCache.set(key, null);
  return null;
};

// Browser speech playback with locale-specific voice selection.
export const speak = (text: string, bcp47: string, onError?: () => void): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return false;
  const voice = resolveVoice(bcp47);
  // The engine can select a default voice for the requested locale while its
  // voice list is still loading, but a loaded list without a match is unsupported.
  if (!voice && speechSynthesis.getVoices().length > 0) return false;
  const prefix = bcp47.toLowerCase().split("-")[0];
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47;
  if (voice) u.voice = voice;
  u.rate = prefix === "zh" ? 0.95 : 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  u.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") onError?.();
  };
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
};

// Thin enum wrapper for call sites that carry a SpeechLang. Selection logic
// still lives entirely in resolveVoice().
export const speakLang = (text: string, lang: SpeechLang = "zh"): boolean =>
  speak(text, BCP47[lang] ?? "en-US");

// Best-effort probe. Optimistic when the voice list hasn't loaded yet
// (common on iOS webviews on the first render) to avoid false negatives.
export const hasVoiceForBcp47 = (bcp47: string): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return true;
  const prefix = bcp47.toLowerCase().split("-")[0];
  return voices.some((v) => v.lang?.toLowerCase().startsWith(prefix));
};

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    // Voice list changed — drop cache so the next call re-resolves.
    voiceCache.clear();
    speechSynthesis.getVoices();
  };
}
