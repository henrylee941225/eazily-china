import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ImageIcon } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import type { CityPick } from "@/data/cities";
import { INTERESTS, isInterestId, pickInterests, type InterestId } from "@/data/interests";
import { imageForPick } from "@/assets/picks";
import { PickDetailSheet } from "@/components/PickDetailSheet";
import { supabase } from "@/integrations/supabase/client";

type Pick = CityPick;

const accentClass = (a: Pick["accent"]) =>
  a === "violet"
    ? "bg-jade/15 text-jade"
    : a === "cyan"
    ? "bg-vermilion/10 text-vermilion"
    : "bg-gold/15 text-[hsl(var(--gold))]";

/**
 * Strip price tokens (¥, HK$, $) from the meta string — we don't show
 * prices on cards because they aren't sourced from a verified API.
 * Returns the cleaned meta or null if nothing useful is left.
 */
const cleanMeta = (meta: string | undefined): string | null => {
  if (!meta) return null;
  // CJK detector — this app targets foreign travellers, so anything in
  // Chinese script gets dropped rather than shown untranslated.
  const hasCJK = (s: string) =>
    /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/.test(s);
  const parts = meta
    .split("·")
    .map((p) => p.trim())
    .filter((p) => p && !/[¥$]|HK\$/.test(p) && !hasCJK(p));
  const joined = parts.join(" · ");
  return joined || null;
};

// Mirror of the server-side slug in supabase/functions/pick-image/index.ts.
// Must stay in sync so the client can construct the same public URL that the
// edge function uploads to.
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const publicPickImageUrl = (city: string, title: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/pick-images/${slug(city)}/${slug(title)}.png`;

/** Single card — owns its own image fetch so each pick lands as soon as ready. */
const PickCard = ({
  pick,
  cityName,
  onOpen,
}: {
  pick: Pick;
  cityName: string;
  onOpen: () => void;
}) => {
  const { user: cardUser } = useAuth();
  const signedIn = !!cardUser;
  const staticSrc = imageForPick(pick.title);
  const imgCacheKey = `pick-img:v1:${cityName}:${pick.title}`;
  // Try the deterministic public storage URL first — works for both logged-in
  // and logged-out users as soon as ANY authed user has generated it once.
  const candidateUrl = staticSrc ? null : publicPickImageUrl(cityName, pick.title);
  const [aiSrc, setAiSrc] = useState<string | null>(() => {
    if (staticSrc) return null;
    try {
      const cached = localStorage.getItem(imgCacheKey);
      if (cached) return cached;
    } catch { /* ignore */ }
    return candidateUrl;
  });
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  // If the deterministic URL 404s AND the user is signed in, ask the edge
  // function to generate it. Logged-out users just see the placeholder until
  // a signed-in viewer triggers generation.
  useEffect(() => {
    if (staticSrc) return;
    if (!imgFailed) return;
    if (!signedIn) return;
    let cancelled = false;
    (async () => {
      try {
        setImgLoading(true);
        const { data, error } = await supabase.functions.invoke("pick-image", {
          body: { title: pick.title, city: cityName, tag: pick.tag, blurb: pick.blurb },
        });
        if (cancelled) return;
        if (error) throw error;
        if (typeof data?.image === "string") {
          setAiSrc(data.image);
          setImgFailed(false);
          try { localStorage.setItem(imgCacheKey, data.image); } catch { /* quota */ }
        }
      } catch (e) {
        console.warn("pick-image failed", e);
      } finally {
        if (!cancelled) setImgLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [imgFailed, staticSrc, pick.title, pick.tag, pick.blurb, cityName, imgCacheKey, signedIn]);

  const src = staticSrc ?? (imgFailed ? null : aiSrc);
  const meta = cleanMeta(pick.meta);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex w-[88%] shrink-0 cursor-pointer snap-start flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-soft transition hover:shadow-elegant focus:outline-none focus-visible:ring-2 focus-visible:ring-vermilion sm:w-[420px]"
    >
      {/* Image — always rendered so card heights match */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40">
        {src ? (
          <img
            src={src}
            alt={pick.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            {imgLoading ? (
              <div className="h-6 w-6 animate-pulse rounded-full bg-muted-foreground/20" />
            ) : (
              <ImageIcon className="h-6 w-6" />
            )}
          </div>
        )}
      </div>

      {/* Body — uniform padding & rhythm */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-medium leading-snug text-ink break-words">
          {pick.title}
        </h3>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${accentClass(
              pick.accent
            )}`}
          >
            {pick.tag}
          </span>
          {meta && (
            <span className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              {meta}
            </span>
          )}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground break-words">
          {pick.blurb}
        </p>

        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/15 bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-vermilion/40 hover:text-vermilion"
            >
              <Sparkles className="h-3 w-3" />
              Ask Concierge
            </button>
        </div>
      </div>
    </article>
  );
};

export const TodaysPicksCarousel = () => {
  const { city } = useCity();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Pick | null>(null);
  const [open, setOpen] = useState(false);

  const userInterests = useMemo<InterestId[]>(
    () => (((profile as any)?.interests ?? []) as string[]).filter(isInterestId),
    [profile]
  );

  // Cache key: city + UTC date + interests signature.
  // Picks only refresh when the day rolls over OR the user changes interests.
  // v2 bump = new Amap-verified pick shape.
  const todayUTC = new Date().toISOString().slice(0, 10);
  const interestsSig = [...userInterests].sort().join(",");
  const cacheKey = `daily-picks:v3:${city.id}:${todayUTC}:${interestsSig}`;

  // Hong Kong is not covered by Amap's mainland POI database, so we don't
  // call the verified-picks endpoint for it — see message below.
  const skipForCity = city.id === "hong-kong";

  const readCache = (): Pick[] | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? (parsed as Pick[]) : null;
    } catch {
      return null;
    }
  };

  const [aiPicks, setAiPicks] = useState<Pick[] | null>(() => readCache());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch a fresh, Amap-verified set of picks for today, per city.
  // Client-side cached for the UTC day + current interests so repeat opens
  // don't re-shuffle or re-flicker. Only refetches when day or interests change.
  // Public endpoint — no auth required.
  useEffect(() => {
    if (skipForCity || !user) {
      setAiPicks(null);
      setAiLoading(false);
      return;
    }
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      setAiPicks(cached);
      setAiLoading(false);
      return;
    }
    setAiPicks(null);
    setAiLoading(true);
    setAiError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("daily-picks", {
          body: { city: city.name, cityZh: city.nameZh, interests: userInterests },
        });
        if (cancelled) return;
        if (error) throw error;
        if (Array.isArray(data?.picks) && data.picks.length) {
          setAiPicks(data.picks as Pick[]);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data.picks));
          } catch {
            /* quota — ignore */
          }
        } else {
          setAiError("Today's picks aren't ready yet — check back shortly.");
        }
      } catch (e) {
        console.warn("daily-picks failed", e);
        if (!cancelled) setAiError("Couldn't load today's picks. Try again in a moment.");
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city.id, city.name, city.nameZh, cacheKey, skipForCity, userInterests, user]);

  // Every card must be a real, Amap-verified venue — no static seed fallback.
  // While we're loading or if no verified picks came back, show skeletons or
  // the error/coverage message rather than invented data.
  const showSkeletons = !skipForCity && !aiPicks && aiLoading;
  const sourcePicks = aiPicks ?? [];

  // Reorder picks by how many of the user's interests they match.
  // Equal matches keep original order. No filtering — everything still shows.
  const PICKS = useMemo(() => {
    if (!userInterests.length) return sourcePicks;
    const userSet = new Set(userInterests);
    return sourcePicks
      .map((p, i) => {
        const tags = pickInterests(p);
        const matches = tags.filter((t) => userSet.has(t)).length;
        return { p, i, matches };
      })
      .sort((a, b) => (b.matches - a.matches) || (a.i - b.i))
      .map((x) => x.p);
  }, [sourcePicks, userInterests]);

  const interestLabel = (id: InterestId) =>
    INTERESTS.find((i) => i.id === id)?.label ?? id;

  return (
    <section className="container mx-auto px-4 pt-8 pb-10 sm:pt-10">
      <div className="mb-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {userInterests.length ? "Based on your interests" : "Hand-picked today"}
        </h2>
        {aiLoading && !aiPicks && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Refreshing today's picks…
          </p>
        )}
        {userInterests.length > 0 && (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-vermilion/80 break-words">
            tuned to {userInterests.slice(0, 3).map(interestLabel).join(" · ")}
            {userInterests.length > 3 ? ` · +${userInterests.length - 3}` : ""}
          </p>
        )}
      </div>

      {skipForCity && (
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 text-sm text-muted-foreground shadow-soft">
          Verified picks aren't available for Hong Kong yet — our source (Amap)
          covers mainland China only. Coming soon.
        </div>
      )}

      {!skipForCity && !aiLoading && !sourcePicks.length && aiError && (
        <div className="rounded-2xl border border-foreground/10 bg-card p-5 text-sm text-muted-foreground shadow-soft">
          {aiError}
        </div>
      )}

      {/* Native horizontal swipe — no auto-advance, no controls */}
      {!skipForCity && (sourcePicks.length > 0 || showSkeletons) && <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" }}
      >
        {showSkeletons
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="flex w-[88%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-soft sm:w-[420px]"
              >
                <div className="aspect-[16/10] w-full animate-pulse bg-muted/50" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted/60" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted/40" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
                </div>
              </div>
            ))
          : PICKS.map((p) => (
          <PickCard
            key={p.title}
            pick={p}
            cityName={city.name}
            onOpen={() => {
              if (!user) {
                navigate("/auth");
                return;
              }
              setSelected(p);
              setOpen(true);
            }}
          />
          ))}
      </div>}

      <PickDetailSheet
        pick={selected}
        city={city.name}
        open={open}
        onOpenChange={setOpen}
      />
    </section>
  );
};
