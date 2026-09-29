import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Cross-session soft exclusion. Persists the last N venue ids the AI
// recommended to a user on `profiles.recently_recommended`, then merges them
// into the exclude set on subsequent recommend-* calls so users see fresh
// picks across sessions. Applied softly — see caller for the pool-size gate.
const CAP = 15;

const admin = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
};

export const readRecentlyRecommended = async (
  userId: string,
): Promise<string[]> => {
  const client = admin();
  if (!client) return [];
  const { data, error } = await client
    .from("profiles")
    .select("recently_recommended")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("readRecentlyRecommended:", error.message);
    return [];
  }
  const list = (data?.recently_recommended ?? []) as unknown;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
};

export const appendRecentlyRecommended = async (
  userId: string,
  ids: string[],
): Promise<void> => {
  const clean = ids.filter((x) => typeof x === "string" && x.length > 0);
  if (clean.length === 0) return;
  const client = admin();
  if (!client) return;
  const current = await readRecentlyRecommended(userId);
  // Newest last. De-dup by dropping any previous occurrences of the new ids,
  // then append, then trim to the cap by dropping the oldest.
  const kept = current.filter((x) => !clean.includes(x));
  const merged = [...kept, ...clean].slice(-CAP);
  const { error } = await client
    .from("profiles")
    .update({ recently_recommended: merged })
    .eq("user_id", userId);
  if (error) console.warn("appendRecentlyRecommended:", error.message);
};

// Fisher-Yates shuffle (in place, returns the array for chaining).
export const shuffle = <T,>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};