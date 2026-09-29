import {
  shanghaiNightlife,
  type ShanghaiNightlifeVenue,
} from "@/data/shanghai-nightlife";

/**
 * Read-only selectors over the nightlife dataset. The data file is never
 * edited or merged with the dining/bars datasets — this module is the only
 * access path. No coordinates exist, so nothing here supports maps, distance
 * or proximity sorting.
 */

export const getAllNightlife = (): ShanghaiNightlifeVenue[] =>
  [...shanghaiNightlife].sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

export const getNightlifeBySlug = (
  slug: string,
): ShanghaiNightlifeVenue | undefined =>
  shanghaiNightlife.find((v) => v.slug === slug);

export const getNightlifeByArea = (area: string): ShanghaiNightlifeVenue[] =>
  getAllNightlife().filter((v) => v.area === area);

export const getNightlifeAreas = (): string[] =>
  Array.from(
    new Set(
      shanghaiNightlife
        .map((v) => v.area)
        .filter((a): a is string => !!a),
    ),
  ).sort((a, b) => a.localeCompare(b, "en-GB"));

export const getNightlifeTypes = (): string[] =>
  Array.from(new Set(shanghaiNightlife.map((v) => v.venueType))).sort((a, b) =>
    a.localeCompare(b, "en-GB"),
  );

export type { ShanghaiNightlifeVenue };
