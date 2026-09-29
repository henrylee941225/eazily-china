import type { CityPick, PickCategoryId } from "@/data/cities";

// Human-readable label per canonical category id. The overline reads this
// directly from the pick's `category` field — no tag guessing.
const LABEL: Record<PickCategoryId, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  bar: "Bar",
  attraction: "Attraction",
  museum: "Museum",
  gallery: "Gallery",
  park: "Park",
  temple: "Temple",
  shopping: "Shopping",
  view: "View",
};

export function pickCategoryLabel(pick: Pick<CityPick, "category"> | null | undefined): string | null {
  const c = pick?.category;
  if (!c) return null;
  return LABEL[c] ?? null;
}
