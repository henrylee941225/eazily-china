// Curated venue lists. Every venueId here must resolve to a real entry in the
// grounded venue index (src/data/cities.ts → picks). No fabricated venues,
// price bands or descriptors. Missing fields must be omitted at render time,
// not filled in.

import { CITIES, type CityPick } from "@/data/cities";
import { pickId } from "@/lib/wizardVenues";

// pickId kept in imports for future PLACE_GUIDES entries.
void pickId;

export type PlaceGuideEntry = { venueId: string; tag?: string };

export type PlaceGuide = {
  slug: string;
  title: string;
  topicSlug: string;
  cityId: string;
  intro: string;
  entries: PlaceGuideEntry[];
};

export const PLACE_GUIDES: PlaceGuide[] = [];

export function getPlaceGuide(slug: string): PlaceGuide | undefined {
  return PLACE_GUIDES.find((p) => p.slug === slug);
}

export function getPlaceGuidesForTopic(topicSlug: string): PlaceGuide[] {
  return PLACE_GUIDES.filter((p) => p.topicSlug === topicSlug);
}

/** Resolve a venueId back to its CityPick entry from the grounded index. */
export function resolveVenue(
  cityId: string,
  venueId: string,
): { pick: CityPick; cityName: string } | null {
  const city = CITIES.find((c) => c.id === cityId);
  if (!city) return null;
  const pick = city.picks.find((p) => pickId(p) === venueId);
  if (!pick) return null;
  return { pick, cityName: city.name };
}

/** Extract the ¥/¥¥ price band from a pick's meta string, if present. */
export function priceBand(meta?: string): string | null {
  if (!meta) return null;
  const m = meta.match(/¥+/);
  return m ? m[0] : null;
}

/** Extract the area portion of a pick's meta string — the first
 *  middot-separated segment that does not contain a ¥ symbol. Returns null
 *  if nothing sensible remains. */
export function areaFromMeta(meta?: string): string | null {
  if (!meta) return null;
  const first = meta.split("·")[0]?.trim() ?? "";
  if (!first || /¥/.test(first)) return null;
  return first;
}