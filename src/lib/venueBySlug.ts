import { SHANGHAI_DINING } from "@/content/shanghaiDining";
import { shanghaiBars } from "@/data/shanghai-bars";
import { shanghaiNightlife } from "@/data/shanghai-nightlife";

/**
 * Slug → venue lookup shared by the concierge "reserve" action and any other
 * surface that needs to pre-select a venue in the booking flow.
 *
 * Matching is on slug only. Display names are not unique across the three
 * datasets, so a name match could resolve to the wrong venue.
 *
 * Some venues exist in more than one dataset. Resolution order is fixed:
 *   1. dining directory (`src/content/shanghaiDining.ts`)
 *   2. standalone bars (`src/data/shanghai-bars.ts`)
 *   3. nightlife (`src/data/shanghai-nightlife.ts`)
 * The first match wins, mirroring the directory's "dining entry wins" policy.
 *
 * Read-only: no data file is mutated or merged.
 */
export type ResolvedVenue = {
  slug: string;
  name: string;
  nameZh?: string;
  area?: string;
  address?: string;
};

export const resolveVenueBySlug = (
  slug: string | null | undefined,
): ResolvedVenue | null => {
  const key = slug?.trim();
  if (!key) return null;

  const dining = SHANGHAI_DINING.find((v) => v.slug === key);
  if (dining) {
    return {
      slug: dining.slug,
      name: dining.name,
      nameZh: dining.name_zh ?? undefined,
      area: dining.area ?? undefined,
      address: dining.address_en ?? dining.address_cn ?? undefined,
    };
  }

  const bar = shanghaiBars.find((v) => v.slug === key);
  if (bar) {
    return {
      slug: bar.slug,
      name: bar.name,
      nameZh: bar.nameZh ?? undefined,
      area: bar.area ?? undefined,
      address: bar.address ?? bar.addressZh ?? undefined,
    };
  }

  const club = shanghaiNightlife.find((v) => v.slug === key);
  if (club) {
    return {
      slug: club.slug,
      name: club.name,
      nameZh: club.nameZh,
      area: club.area,
      address: club.address ?? club.addressZh,
    };
  }

  return null;
};

/** Query string that makes the booking flow open with the venue pre-selected. */
export const bookingParamsForVenue = (venue: ResolvedVenue): string => {
  const params = new URLSearchParams();
  params.set("venueName", venue.name);
  if (venue.nameZh) params.set("venueNameZh", venue.nameZh);
  if (venue.area) params.set("venueArea", venue.area);
  if (venue.address) params.set("venueAddress", venue.address);
  params.set("venueSlug", venue.slug);
  return params.toString();
};
