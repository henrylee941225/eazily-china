import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PickDetailSheet } from "@/components/PickDetailSheet";
import { imageForPick } from "@/assets/picks";
import {
  areaFromMeta,
  getPlaceGuide,
  priceBand,
  resolveVenue,
} from "@/content/placeGuides";
import type { CityPick } from "@/data/cities";

const PlaceGuide = () => {
  const { placeGuideSlug = "" } = useParams();
  const guide = getPlaceGuide(placeGuideSlug);
  const [selected, setSelected] = useState<{ pick: CityPick; city: string } | null>(null);

  if (!guide) return <Navigate to="/guides/eat-and-drink" replace />;

  const resolved = guide.entries
    .map((e) => {
      const v = resolveVenue(guide.cityId, e.venueId);
      return v ? { ...v, tag: e.tag as string | undefined } : null;
    })
    .filter(
      (x): x is { pick: CityPick; cityName: string; tag: string | undefined } => !!x,
    );

  return (
    <AppLayout title={guide.title} showBack backTo={`/guides/${guide.topicSlug}`}>
      <div className="mx-auto w-full max-w-[440px] space-y-5">
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          {guide.intro}
        </p>

        {resolved.length === 0 ? (
          <div className="rounded-2xl bg-[#F6F6F7] px-4 py-8 text-center text-[14px] text-ink-secondary">
            This list is being curated.
          </div>
        ) : (
          <ul className="space-y-3">
            {resolved.map(({ pick, cityName, tag }) => {
              const img = imageForPick(pick.title);
              const area = areaFromMeta(pick.meta);
              const price = priceBand(pick.meta);
              const descriptor = pick.blurb?.trim() || null;
              const parts = [area, descriptor, price].filter(Boolean) as string[];
              return (
                <li key={pick.title}>
                  <button
                    type="button"
                    onClick={() => setSelected({ pick, city: cityName })}
                    className="block w-full overflow-hidden rounded-2xl border border-[#E2E2E2] bg-white text-left transition active:bg-[#F6F6F7]"
                  >
                    <div className="relative aspect-[16/9] w-full bg-[#F6F6F7]">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-4 text-center text-[13px] text-ink-tertiary">
                          {pick.title}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-semibold leading-snug text-ink">
                          {pick.title}
                        </div>
                        {parts.length > 0 && (
                          <div className="mt-1 line-clamp-2 text-[13px] text-ink-secondary">
                            {parts.join(" · ")}
                          </div>
                        )}
                      </div>
                      {tag && (
                        <span className="shrink-0 rounded-full bg-[#F6F6F7] px-2.5 py-1 text-[11px] font-semibold text-ink">
                          {tag}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <PickDetailSheet
        pick={selected?.pick ?? null}
        city={selected?.city ?? ""}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
      />
    </AppLayout>
  );
};

export default PlaceGuide;