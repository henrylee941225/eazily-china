import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Disc3, Utensils, Wine } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getGuidesInTopic, getTopic } from "@/content/guides";
import { getPlaceGuidesForTopic } from "@/content/placeGuides";
import { SHANGHAI_DINING } from "@/content/shanghaiDining";
import { ALL_BARS } from "@/lib/bars";
import { getAllNightlife } from "@/lib/nightlife";

const GuideTopic = () => {
  const { topicSlug = "" } = useParams();
  const topic = getTopic(topicSlug);
  if (!topic) return <Navigate to="/guides" replace />;

  const guides = getGuidesInTopic(topicSlug);
  const placeGuides = getPlaceGuidesForTopic(topicSlug);
  const hasDirectory = topicSlug === "eat-and-drink";
  const restaurantCount = SHANGHAI_DINING.filter((v) => v.entity === "restaurant").length;
  const barCount = ALL_BARS.length;
  const nightlifeCount = getAllNightlife().length;

  return (
    <AppLayout title={topic.title} showBack backTo="/guides">
      <div className="mx-auto w-full max-w-[440px] space-y-5">
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          {topic.intro}
        </p>

        {topicSlug === "eat-and-drink" && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/guides/eat-and-drink/directory?entity=restaurant"
              className="flex flex-col gap-3 rounded-2xl bg-[#F6F6F7] p-4 active:bg-[#F3F3F4]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink">
                <Utensils className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[15px] font-semibold leading-tight text-ink">
                  Restaurants
                </div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {restaurantCount} places
                </div>
              </div>
            </Link>
            <Link
              to="/guides/eat-and-drink/directory?entity=bar"
              className="flex flex-col gap-3 rounded-2xl bg-[#F6F6F7] p-4 active:bg-[#F3F3F4]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink">
                <Wine className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[15px] font-semibold leading-tight text-ink">
                  Bars
                </div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {barCount} places
                </div>
              </div>
            </Link>
            <Link
              to="/guides/eat-and-drink/nightlife"
              className="flex flex-col gap-3 rounded-2xl bg-[#F6F6F7] p-4 active:bg-[#F3F3F4]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink">
                <Disc3 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[15px] font-semibold leading-tight text-ink">
                  Nightlife
                </div>
                <div className="mt-0.5 text-[13px] text-ink-secondary">
                  {nightlifeCount} places
                </div>
              </div>
            </Link>
          </div>
        )}

        {guides.length === 0 && placeGuides.length === 0 && !hasDirectory ? (
          <div className="rounded-2xl bg-[#F6F6F7] px-4 py-8 text-center text-[14px] text-ink-secondary">
            More guides for {topic.title.toLowerCase()} coming soon.
          </div>
        ) : guides.length > 0 ? (
          <ul className="divide-y divide-[#E2E2E2]">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link
                  to={`/guides/${g.topicSlug}/${g.slug}`}
                  className="flex items-start gap-4 py-4 active:bg-[#F6F6F7]"
                >
                  <span className="w-7 shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-ink-tertiary">
                    {String(g.order).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold leading-snug text-ink">
                      {g.title}
                    </div>
                    <div className="mt-0.5 text-[13px] text-ink-secondary">
                      {g.readMinutes} min
                      {g.subtitle ? ` · ${g.subtitle}` : ""}
                    </div>
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-ink-tertiary"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {placeGuides.length > 0 && (
          <section className="pt-2">
            <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
              Curated lists
            </div>
            <ul className="divide-y divide-[#E2E2E2]">
              {placeGuides.map((p) => (
                <li key={p.slug}>
                  <Link
                    to={`/guides/places/${p.slug}`}
                    className="flex items-start gap-4 py-4 active:bg-[#F6F6F7]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-semibold leading-snug text-ink">
                        {p.title}
                      </div>
                      <div className="mt-0.5 text-[13px] text-ink-secondary">
                        {p.entries.length} {p.entries.length === 1 ? "spot" : "spots"}
                      </div>
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-ink-tertiary"
                      strokeWidth={2}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default GuideTopic;