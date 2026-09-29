// Standalone wrapper around MapKit JS Search so non-map screens can call
// autocomplete/place resolution without mounting an <AppleMap />.
//
// Init/token handling is delegated to AppleMap.tsx via the shared
// `waitForMapkit` + `initializeMapkit` exports — this module never
// re-implements the authorizationCallback or touches the
// `__mapkitInitialized` guard directly.
//
// Default region bias is Shanghai (the only city the app operates in).

import {
  waitForMapkit,
  initializeMapkit,
  type AutocompleteSuggestion,
  type Place,
} from "@/components/AppleMap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapkitApi = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapkitSearchInstance = any;

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Shanghai municipal viewbox — roughly matches the previous Nominatim
// `viewbox=DEFAULT_CENTER ± 0.6°` bias used on the Maps screen.
export const SHANGHAI_REGION: Region = {
  latitude: 31.2304,
  longitude: 121.4737,
  latitudeDelta: 1.2,
  longitudeDelta: 1.2,
};

let searchInstance: MapkitSearchInstance | null = null;

const ensureMapkit = async (): Promise<MapkitApi> => {
  const mapkit = await waitForMapkit();
  initializeMapkit(mapkit);
  return mapkit;
};

const buildRegion = (mapkit: MapkitApi, r: Region) =>
  new mapkit.CoordinateRegion(
    new mapkit.Coordinate(r.latitude, r.longitude),
    new mapkit.CoordinateSpan(r.latitudeDelta, r.longitudeDelta),
  );

const getSearch = (mapkit: MapkitApi, region: Region): MapkitSearchInstance => {
  const mkRegion = buildRegion(mapkit, region);
  if (!searchInstance) {
    searchInstance = new mapkit.Search({ region: mkRegion });
  } else {
    try {
      searchInstance.region = mkRegion;
    } catch {
      // ignore — some MapKit builds reject region reassignment
    }
  }
  return searchInstance;
};

export type AutocompleteOptions = {
  region?: Region;
  signal?: AbortSignal;
};

// Adapts MapKit's callback-shaped autocomplete into a promise. When
// `signal` aborts, the promise resolves to `[]` and the underlying
// callback's later value is ignored — MapKit doesn't expose a cancel
// hook, so we discard stale results at the boundary instead.
export const searchAutocomplete = async (
  query: string,
  options: AutocompleteOptions = {},
): Promise<AutocompleteSuggestion[]> => {
  const q = query.trim();
  if (!q) return [];
  if (options.signal?.aborted) return [];

  const mapkit = await ensureMapkit();
  if (options.signal?.aborted) return [];

  const region = options.region ?? SHANGHAI_REGION;
  const search = getSearch(mapkit, region);
  const mkRegion = buildRegion(mapkit, region);

  return new Promise<AutocompleteSuggestion[]>((resolve) => {
    let settled = false;
    const settle = (value: AutocompleteSuggestion[]) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    if (options.signal) {
      options.signal.addEventListener("abort", () => settle([]), { once: true });
    }

    try {
      search.autocomplete(
        q,
        (
          error: unknown,
          data: {
            results?: Array<{
              displayLines?: string[];
              coordinate?: { latitude: number; longitude: number };
            }>;
          },
        ) => {
          if (options.signal?.aborted) {
            settle([]);
            return;
          }
          if (error || !data?.results) {
            settle([]);
            return;
          }
          settle(
            data.results.map((r) => ({
              displayLines: r.displayLines ?? [],
              coordinate: r.coordinate,
              raw: r,
            })),
          );
        },
        { region: mkRegion },
      );
    } catch (e) {
      console.warn("[mapkitSearch] autocomplete failed", e);
      settle([]);
    }
  });
};

export type ResolvePlaceOptions = {
  region?: Region;
};

// Materialises a suggestion into a full Place. If the suggestion
// already carries a coordinate, we return a lightweight Place built
// from its display lines and skip the network round-trip.
export const resolvePlace = async (
  suggestion: AutocompleteSuggestion,
  options: ResolvePlaceOptions = {},
): Promise<Place | null> => {
  if (suggestion.coordinate) {
    return {
      name: suggestion.displayLines[0],
      formattedAddress:
        suggestion.displayLines.slice(1).join(", ") || suggestion.displayLines[0],
      coordinate: suggestion.coordinate,
    };
  }

  const mapkit = await ensureMapkit();
  const region = options.region ?? SHANGHAI_REGION;
  const search = getSearch(mapkit, region);
  const query =
    suggestion.displayLines.join(", ") || suggestion.displayLines[0] || "";
  if (!query) return null;

  return new Promise<Place | null>((resolve) => {
    try {
      search.search(query, (error: unknown, data: { places?: Place[] }) => {
        if (error || !data?.places?.length) {
          resolve(null);
          return;
        }
        resolve(data.places[0]);
      });
    } catch (e) {
      console.warn("[mapkitSearch] resolvePlace failed", e);
      resolve(null);
    }
  });
};

export type { AutocompleteSuggestion, Place };