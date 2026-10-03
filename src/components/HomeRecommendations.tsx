import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { imageForPick } from "@/assets/picks";
import { PickDetailSheet } from "@/components/PickDetailSheet";
import { pickCategoryLabel } from "@/lib/pickCategory";
import { isInterestId, pickInterests, type InterestId } from "@/data/interests";
import type { CityPick } from "@/data/cities";

// Mirror of the server-side slug in supabase/functions/pick-image/index.ts —
// kept in sync with TodaysPicksCarousel so the same deterministic public URL
// is reused (no extra edge invocations on Home).
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const publicPickImageUrl = (city: string, title: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/pick-images/${slug(city)}/${slug(title)}.png`;

const RecCard = ({
  pick,
  city,
  onOpen,
}: {
  pick: CityPick;
  city: string;
  onOpen: () => void;
}) => {
  const { user: cardUser } = useAuth();
  const signedIn = !!cardUser;
  const staticSrc = imageForPick(pick.title);
  const cacheKey = `pick-img:v1:${city}:${pick.title}`;
  const [aiSrc, setAiSrc] = useState<string | null>(() => {
    if (staticSrc) return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch { /* ignore */ }
    return publicPickImageUrl(city, pick.title);
  });
  const [failed, setFailed] = useState(false);
  const src = staticSrc ?? (failed ? null : aiSrc);
  const categoryLabel = pickCategoryLabel(pick);

  // If the deterministic URL 404s, ask the edge function to generate it
  // (same pattern as TodaysPicksCarousel — signed-in users trigger it).
  useEffect(() => {
    if (staticSrc || !failed || !signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("pick-image", {
          body: { title: pick.title, city, tag: pick.tag, blurb: pick.blurb },
        });
        if (cancelled) return;
        if (error) throw error;
        if (typeof data?.image === "string") {
          setAiSrc(data.image);
          setFailed(false);
          try { localStorage.setItem(cacheKey, data.image); } catch { /* quota */ }
        }
      } catch (e) {
        console.warn("pick-image failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [failed, staticSrc, pick.title, pick.tag, pick.blurb, city, cacheKey, signedIn]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-[70%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-white text-left shadow-none transition hover:bg-surface-2/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-red))] sm:w-[260px]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-surface-2">
        {src ? (
          <img
            src={src}
            alt={pick.title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-tertiary/60">
            <ImageIcon className="h-5 w-5" strokeWidth={1.6} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        {categoryLabel && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
            {categoryLabel}
          </p>
        )}
        <p className="line-clamp-2 text-[16px] font-semibold leading-snug text-ink">
          {pick.title}
        </p>
      </div>
    </button>
  );
};

export const HomeRecommendations = () => {
  const { city } = useCity();
  const { profile, user } = useAuth();
  const [selected, setSelected] = useState<CityPick | null>(null);
  const [open, setOpen] = useState(false);

  const userInterests = useMemo<InterestId[]>(
    () => (profile?.interests ?? []).filter(isInterestId),
    [profile],
  );

  // Amap has no coverage for Hong Kong — the daily-picks function skips it,
  // so we skip the whole section rather than fabricate anything.
  const skipForCity = city.id === "hong-kong";

  // Reuse the same cache key/shape as TodaysPicksCarousel so the two surfaces
  // share one localStorage entry per city+day+interests. No fresh network
  // call from Home if TodaysPicksCarousel already loaded them.
  const todayUTC = new Date().toISOString().slice(0, 10);
  const interestsSig = [...userInterests].sort().join(",");
  const cacheKey = `daily-picks:v3:${city.id}:${todayUTC}:${interestsSig}`;

  const readCache = (): CityPick[] | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? (parsed as CityPick[]) : null;
    } catch {
      return null;
    }
  };

  const [picks, setPicks] = useState<CityPick[] | null>(() => readCache());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (skipForCity || !user) { setPicks(null); setLoading(false); return; }
    const cached = readCache();
    if (cached) { setPicks(cached); setLoading(false); return; }
    let cancelled = false;
    setPicks(null);
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("daily-picks", {
          body: { city: city.name, cityZh: city.nameZh, interests: userInterests },
        });
        if (cancelled) return;
        if (error) throw error;
        if (Array.isArray(data?.picks) && data.picks.length) {
          setPicks(data.picks as CityPick[]);
          try { localStorage.setItem(cacheKey, JSON.stringify(data.picks)); } catch { /* quota */ }
        }
      } catch (e) {
        console.warn("daily-picks failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.id, cacheKey, skipForCity, user]);

  // Ranking by interest match — matches the Today's Picks logic so the two
  // surfaces stay coherent for the same user.
  const ordered = useMemo(() => {
    const base = picks ?? [];
    if (!userInterests.length) return base;
    const userSet = new Set(userInterests);
    return [...base]
      .map((p, i) => ({ p, i, m: pickInterests(p).filter((t) => userSet.has(t)).length }))
      .sort((a, b) => (b.m - a.m) || (a.i - b.i))
      .map((x) => x.p);
  }, [picks, userInterests]);

  if (skipForCity) return null;
  if (!loading && ordered.length === 0) return null;

  return (
    <section aria-label="Recommended for you">
      <h2 className="mb-2 text-[20px] font-bold text-ink">Recommended for you</h2>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
      >
        {loading && ordered.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`rec-sk-${i}`}
                className="flex w-[70%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-white sm:w-[260px]"
              >
                <div className="aspect-[4/3] w-full animate-pulse rounded-t-2xl bg-surface-2" />
                <div className="flex flex-col gap-1.5 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
                </div>
              </div>
            ))
          : ordered.slice(0, 8).map((p) => (
              <RecCard
                key={p.title}
                pick={p}
                city={city.name}
                onOpen={() => { setSelected(p); setOpen(true); }}
              />
            ))}
      </div>

      <PickDetailSheet
        pick={selected}
        city={city.name}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
};
