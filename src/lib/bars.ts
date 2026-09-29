import { shanghaiBars, type ShanghaiBar } from "@/data/shanghai-bars";
import { SHANGHAI_DINING, type DiningVenue } from "@/content/shanghaiDining";

/**
 * Read-time combination of the two bar sources. Neither data file is edited or
 * merged on disk: `src/data/shanghai-bars.ts` and the dining directory stay
 * separate, and this module normalises both shapes into one view model used by
 * the Eat & drink "Bars" category.
 *
 * The standalone bars carry no image, no coordinates and no rating. Those
 * fields are absent, not empty — consumers omit the element entirely rather
 * than rendering a placeholder. Because they have no coordinates they never
 * reach a map, distance readout or proximity sort, and they are never geocoded
 * client-side to fill the gap.
 *
 * Overlap policy: where a standalone bar's name already exists among the
 * dining directory's bar entries, the dining entry wins and the standalone
 * record is withheld so the same venue never renders twice.
 */

/** One view model for both sources. Extra fields exist only on some records. */
export type DirectoryVenue = DiningVenue & {
  /** True for records sourced from the standalone bars dataset. */
  extended?: boolean;
  /** Present only where the source research recorded it. */
  best_for?: string;
  atmosphere?: string;
  signature?: string;
  source_url?: string;
  /** True only where the record has usable coordinates elsewhere in the app. */
  has_coordinates?: boolean;
};

const normaliseName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const diningBars = SHANGHAI_DINING.filter((v) => v.entity === "bar");

const existingBarNames = new Set(diningBars.map((v) => normaliseName(v.name)));

const duplicates = shanghaiBars.filter((bar) =>
  existingBarNames.has(normaliseName(bar.name)),
);

if (duplicates.length > 0 && import.meta.env.DEV) {
  console.warn(
    "[bars] Withheld — these names already exist in the dining directory:",
    duplicates.map((b) => `${b.name} (${b.slug})`),
  );
}

const toDirectoryVenue = (bar: ShanghaiBar): DirectoryVenue => ({
  slug: bar.slug,
  entity: "bar",
  name: bar.name,
  name_zh: bar.nameZh ?? null,
  branch: null,
  cuisine: null,
  area: bar.area,
  price_band: bar.priceBand,
  occasion: null,
  style: bar.type,
  dish_type: null,
  dietary: null,
  hours: bar.openingHours,
  hours_verified: true,
  address_en: bar.address,
  address_cn: bar.addressZh,
  phone: bar.phone ?? null,
  description: bar.description,
  michelin: null,
  verification: null,
  last_checked: bar.lastChecked,
  source: "curated-2026-07",
  ...(bar.dressCode ? { dress_code: bar.dressCode } : {}),
  ...(bar.bestFor ? { best_for: bar.bestFor } : {}),
  ...(bar.atmosphere ? { atmosphere: bar.atmosphere } : {}),
  ...(bar.signature ? { signature: bar.signature } : {}),
  source_url: bar.sourceUrl,
  extended: true,
  has_coordinates: false,
});

/** The 92 standalone bars, normalised, duplicates withheld. */
export const EXTENDED_BARS: DirectoryVenue[] = shanghaiBars
  .filter((bar) => !existingBarNames.has(normaliseName(bar.name)))
  .map(toDirectoryVenue)
  .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

/** Every bar in the category: dining-directory bars first, then the rest. */
export const ALL_BARS: DirectoryVenue[] = [
  ...(diningBars as DirectoryVenue[]),
  ...EXTENDED_BARS,
];

/** Only records with coordinates may appear on a map surface. */
export const MAPPABLE_BARS: DirectoryVenue[] = ALL_BARS.filter(
  (bar) => bar.extended !== true,
);

export type { ShanghaiBar };
