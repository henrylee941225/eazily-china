import type { CityPick } from "@/data/cities";

/** Deterministic slug id for a picks entry (used to join server results back to
 *  the client-side pick and to feed `exclude` on subsequent calls). */
export const pickId = (p: Pick<CityPick, "title">): string =>
  p.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export type CandidateVenue = {
  id: string;
  name: string;
  name_zh?: string;
  category?: string;
  district?: string;
  meta?: string;
  tag?: string;
  blurb?: string;
};

/** Map a city's picks index into the candidate-venue shape recommend-stops
 *  expects. Uncategorised picks pass through — the server drops them. */
export const buildCandidateVenues = (picks: CityPick[]): CandidateVenue[] =>
  picks.map((p) => ({
    id: pickId(p),
    name: p.title,
    name_zh: p.title_zh,
    category: p.category,
    district: p.district,
    meta: p.meta,
    tag: p.tag,
    blurb: p.blurb,
  }));
