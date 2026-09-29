import { useQuery } from "@tanstack/react-query";
import { fetchVenueImages, type VenueImageMap } from "@/lib/venueImages";

/**
 * One batched fetch + signed-URL call for a set of venue slugs.
 * Signed URLs live 3600s, so cache slightly under that.
 */
export const useVenueImages = (slugs: string[]) => {
  const key = Array.from(new Set(slugs.filter(Boolean))).sort();
  return useQuery<VenueImageMap>({
    queryKey: ["venue-images", key],
    queryFn: () => fetchVenueImages(key),
    enabled: key.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });
};
