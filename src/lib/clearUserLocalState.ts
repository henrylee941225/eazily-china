// Central place to purge per-user localStorage on sign-out.
// Add any new per-user key here — nowhere else.
const EXACT_KEYS = [
  "home:booking-seen",             // Index.tsx SEEN_KEY
  "eazilychina:onboardingComplete",
  "ec_pref_currency",              // CurrencyContext
];

const PREFIXES = [
  "concierge:chat:",   // ConciergeChat transcripts per user
  "pick-img:v1:",      // Home/Today's picks image cache
  "daily-picks:v3:",   // Home/Today's picks list cache
];

export function clearUserLocalState() {
  if (typeof window === "undefined") return;
  try {
    for (const key of EXACT_KEYS) {
      localStorage.removeItem(key);
    }
    // Collect prefixed keys first, then remove — mutating during iteration is unsafe.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (PREFIXES.some((p) => key.startsWith(p))) toRemove.push(key);
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch {
    /* ignore quota / access errors — logout must not fail visibly */
  }
}