import { supabase } from "@/integrations/supabase/client";

/**
 * Single place where venue image access URLs are produced.
 * Swap the body of `resolveUrls` for public URLs later without touching
 * any component.
 */
const BUCKET = "venue-images";
const SIGNED_URL_TTL_SECONDS = 3600;

export type VenueImage = {
  venueSlug: string;
  path: string;
  sortOrder: number;
  url: string;
};

export type VenueImageMap = Record<string, VenueImage[]>;

/** Batch-resolve storage paths to access URLs. One request for all paths. */
const resolveUrls = async (paths: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return out;
  for (const row of data) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
};

/**
 * Fetch the venue_images rows for the given slugs and resolve their URLs in a
 * single batched call. Returns a slug -> images (sort_order asc) map.
 */
export const fetchVenueImages = async (
  slugs: string[],
): Promise<VenueImageMap> => {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .from("venue_images")
    .select("venue_slug, path, sort_order")
    .in("venue_slug", unique)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return {};

  const urls = await resolveUrls(data.map((r) => r.path));

  const map: VenueImageMap = {};
  for (const row of data) {
    const url = urls.get(row.path);
    if (!url) continue;
    (map[row.venue_slug] ??= []).push({
      venueSlug: row.venue_slug,
      path: row.path,
      sortOrder: row.sort_order,
      url,
    });
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
};
