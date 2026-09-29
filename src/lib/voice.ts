// Voice / TTS utility for turn-by-turn navigation announcements.
// Uses the browser's built-in Web Speech API (no external services).

const MUTE_KEY = "eazilychina:voiceMuted";

export function isSupported(): boolean {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  } catch {
    return false;
  }
}

export function hasVoiceForLang(lang: string): boolean {
  try {
    if (!isSupported()) return false;
    const prefix = lang.toLowerCase().slice(0, 2);
    return window.speechSynthesis
      .getVoices()
      .some((v) => v.lang?.toLowerCase().startsWith(prefix));
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
    if (muted) cancel();
  } catch {
    // ignore
  }
}

export function cancel(): void {
  try {
    if (!isSupported()) return;
    window.speechSynthesis.cancel();
    console.log("[VOICE] Cancelled current utterance");
  } catch {
    // ignore
  }
}

export function speak(
  text: string,
  options?: { lang?: string; rate?: number },
): void {
  try {
    if (!isSupported()) {
      console.warn("[VOICE] TTS not supported");
      return;
    }
    if (isMuted()) {
      console.log("[VOICE] Muted, skipping announcement");
      return;
    }
    const lang = options?.lang ?? "en-US";
    const rate = options?.rate ?? 1.0;
    // Cancel any queued/in-progress utterance so only the latest plays.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1.0;
    u.volume = 1.0;
    const prefix = lang.toLowerCase().slice(0, 2);
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith(prefix));
    if (voice) u.voice = voice;
    console.log("[VOICE] Speaking:", text, "| lang:", lang);
    window.speechSynthesis.speak(u);
  } catch (e) {
    // Silent failure — TTS is best-effort.
    console.warn("[VOICE] speak failed", e);
  }
}

// Must be called inside a user-gesture handler (e.g. Start button tap) to
// unlock iOS Safari autoplay restrictions.
export function prime(): void {
  try {
    if (!isSupported()) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    // immediately cancel — we only needed to register the gesture
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  } catch {
    // ignore
  }
}