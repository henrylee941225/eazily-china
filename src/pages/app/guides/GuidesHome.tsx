import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ChevronRight,
  Wallet,
  Train,
  Utensils,
  HandCoins,
  Landmark,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  GUIDE_TOPICS,
  GUIDES,
  countGuides,
  featuredGuide,
} from "@/content/guides";
import { PLACE_GUIDES } from "@/content/placeGuides";
import { SHANGHAI_DINING } from "@/content/shanghaiDining";

// Topics that have a dedicated venue directory (not article-based).
const TOPIC_DIRECTORIES: Record<string, { count: number; noun: string }> = {
  "eat-and-drink": { count: SHANGHAI_DINING.length, noun: "venues" },
};

const ICONS: Record<string, LucideIcon> = {
  Wallet,
  Train,
  Utensils,
  HandCoins,
  Landmark,
  Wifi,
};

const TOPIC_TINTS: Record<string, { icon: string; bg: string }> = {
  "pay-and-money": { icon: "#DE2910", bg: "#FCEAE8" },
  "getting-around": { icon: "#2563EB", bg: "#EAF0FD" },
  "eat-and-drink": { icon: "#EA580C", bg: "#FDF0E7" },
  "culture-and-etiquette": { icon: "#16A34A", bg: "#E9F6EE" },
  "sights-and-museums": { icon: "#7C3AED", bg: "#F2EBFC" },
  "staying-connected": { icon: "#0284C7", bg: "#E7F3FA" },
};

const GuidesHome = () => {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  // Always show all six topics — empty ones render disabled with "Coming soon".
  const visibleTopics = GUIDE_TOPICS;

  const results = useMemo(() => {
    if (!query) return null;
    const guideMatches = GUIDES.filter((g) => {
      const topic = GUIDE_TOPICS.find((t) => t.slug === g.topicSlug);
      return (
        g.title.toLowerCase().includes(query) ||
        (g.subtitle ?? "").toLowerCase().includes(query) ||
        (topic?.title.toLowerCase().includes(query) ?? false)
      );
    }).map((g) => ({ kind: "guide" as const, g }));
    const placeMatches = PLACE_GUIDES.filter((p) => {
      const topic = GUIDE_TOPICS.find((t) => t.slug === p.topicSlug);
      return (
        p.title.toLowerCase().includes(query) ||
        p.intro.toLowerCase().includes(query) ||
        (topic?.title.toLowerCase().includes(query) ?? false)
      );
    }).map((p) => ({ kind: "place" as const, p }));
    return [...guideMatches, ...placeMatches];
  }, [query]);

  const hero = featuredGuide();

  return (
    <AppLayout title="Guides" showBack backTo="/">
      <div className="mx-auto w-full max-w-[440px] space-y-6">
        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            strokeWidth={2}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search guides..."
            aria-label="Search guides"
            className="w-full rounded-full border-0 bg-[#F6F6F7] px-11 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
        </div>

        {results ? (
          <SearchResults results={results} />
        ) : (
          <>
            {/* Featured hero → interactive checklist */}
            <Link
              to="/pretrip"
              className="flex items-center gap-3 rounded-2xl bg-[#F5EFE6] px-5 py-5 transition active:bg-[#EDE5D6]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">
                  Before you fly
                </div>
                <h2 className="mt-1 text-[17px] font-bold leading-tight text-ink">
                  Pre-arrival checklist
                </h2>
                <div className="mt-0.5 text-[13px] leading-snug text-ink/60">
                  Set up before you land — it's much harder after
                </div>
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-ink/60"
                strokeWidth={2}
              />
            </Link>

            {/* Browse by topic */}
            <section>
              <div className="mb-3 text-[15px] font-semibold text-ink">
                Browse by topic
              </div>
              <div className="grid grid-cols-2 gap-3">
                {visibleTopics.map((t) => {
                  const Icon = ICONS[t.icon] ?? Wallet;
                  const n = countGuides(t.slug);
                  const directory = TOPIC_DIRECTORIES[t.slug];
                  const placeCount = PLACE_GUIDES.filter(
                    (p) => p.topicSlug === t.slug,
                  ).length;
                  const empty = n === 0 && !directory && placeCount === 0;
                  const tint = TOPIC_TINTS[t.slug] ?? {
                    icon: "#0A0A0B",
                    bg: "#FFFFFF",
                  };
                  const countLine =
                    n > 0
                      ? `${n} ${n === 1 ? "guide" : "guides"}`
                      : directory
                        ? `${directory.count} ${directory.noun}`
                        : placeCount > 0
                          ? `${placeCount} curated ${placeCount === 1 ? "list" : "lists"}`
                          : "Coming soon";
                  const inner = (
                    <>
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: tint.bg, color: tint.icon }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold leading-tight text-ink">
                          {t.title}
                        </div>
                        <div className="mt-0.5 text-[13px] text-ink-secondary">
                          {countLine}
                        </div>
                      </div>
                    </>
                  );
                  if (empty) {
                    return (
                      <div
                        key={t.slug}
                        aria-disabled="true"
                        className="pointer-events-none flex flex-col gap-3 rounded-2xl bg-[#F6F6F7] p-4 opacity-60"
                      >
                        {inner}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={t.slug}
                      to={`/guides/${t.slug}`}
                      className="flex flex-col gap-3 rounded-2xl bg-[#F6F6F7] p-4 transition active:bg-[#F3F3F4]"
                    >
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
};

type SearchResult =
  | { kind: "guide"; g: (typeof GUIDES)[number] }
  | { kind: "place"; p: (typeof PLACE_GUIDES)[number] };

const SearchResults = ({ results }: { results: SearchResult[] }) => {
  if (results.length === 0) {
    return (
      <div className="rounded-2xl bg-[#F6F6F7] px-4 py-8 text-center text-[14px] text-ink-secondary">
        No guides match that search.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[#E2E2E2]">
      {results.map((r) => {
        if (r.kind === "guide") {
          const topic = GUIDE_TOPICS.find((t) => t.slug === r.g.topicSlug);
          return (
            <li key={`g-${r.g.slug}`}>
              <Link
                to={`/guides/${r.g.topicSlug}/${r.g.slug}`}
                className="flex items-center gap-3 py-3.5 active:bg-[#F6F6F7]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">
                    {r.g.title}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-secondary">
                    {topic?.title} · {r.g.readMinutes} min
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-tertiary" strokeWidth={2} />
              </Link>
            </li>
          );
        }
        const topic = GUIDE_TOPICS.find((t) => t.slug === r.p.topicSlug);
        return (
          <li key={`p-${r.p.slug}`}>
            <Link
              to={`/guides/places/${r.p.slug}`}
              className="flex items-center gap-3 py-3.5 active:bg-[#F6F6F7]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-ink">
                  {r.p.title}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {topic?.title} · Curated list
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-ink-tertiary" strokeWidth={2} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default GuidesHome;