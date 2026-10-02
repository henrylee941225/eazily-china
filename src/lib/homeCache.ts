export const HOME_CACHE_PREFIX = "home:cache:v1:";
export const HOME_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

type HomeCacheKind = "bookings" | "plan";
type Snapshot = { savedAt: number; value: unknown };

const cacheKey = (userId: string, kind: HomeCacheKind) => `${HOME_CACHE_PREFIX}${userId}:${kind}`;

export const readHomeCache = <T>(
  userId: string,
  kind: HomeCacheKind,
  isValid: (value: unknown) => value is T,
): T | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId, kind));
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as Snapshot;
    if (
      !snapshot ||
      typeof snapshot.savedAt !== "number" ||
      !Number.isFinite(snapshot.savedAt) ||
      snapshot.savedAt > Date.now() ||
      Date.now() - snapshot.savedAt > HOME_CACHE_MAX_AGE_MS ||
      !isValid(snapshot.value)
    ) return undefined;
    return snapshot.value;
  } catch {
    return undefined;
  }
};

export const writeHomeCache = <T>(userId: string, kind: HomeCacheKind, value: T): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(userId, kind), JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Storage is optional; the in-memory query cache still works.
  }
};
