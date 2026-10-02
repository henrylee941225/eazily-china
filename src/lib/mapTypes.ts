import type { LatLng } from "@/lib/geoDatum";

export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

// Search results and routing use GCJ-02 in mainland China.
// The renderer converts these coordinates to WGS-84 at the MapTiler boundary.
export type Place = {
  name?: string;
  formattedAddress?: string;
  coordinate?: LatLng;
  photos?: Array<{ url: string; title?: string }>;
  [key: string]: unknown;
};

export type RouteMode = "walk" | "drive" | "transit";

export type RouteStep = {
  instructions: string;
  distance: number;
  path: Array<{ latitude: number; longitude: number }>;
  transportType?: string;
};

export type RouteResult = {
  etaSec: number;
  distance: number;
  steps: RouteStep[];
};

export type ECMapHandle = {
  recenter: () => void;
  search: (
    query: string,
    options?: { glyphText?: string; clusterId?: string; color?: string },
  ) => Promise<number>;
  clearAnnotations: () => void;
  deselectAll: () => void;
  showRoute: (place: Place, mode: RouteMode) => Promise<RouteResult | null>;
  clearRoute: () => void;
  centerOn: (lat: number, lng: number, distance?: number) => void;
  showSinglePlace: (place: Place, glyphText?: string, color?: string) => void;
  setCenterAnimated: (lat: number, lng: number) => void;
  setCameraDistance: (distance: number) => void;
  setRotation: (degrees: number) => void;
  setShowsUserLocation: (visible: boolean) => void;
  setUserOverrideLocation: (coord: { latitude: number; longitude: number } | null) => void;
  setNavigationRoute: (
    steps: RouteStep[],
    destination: { latitude: number; longitude: number },
  ) => void;
  updateNavigationStepIndex: (index: number) => void;
  clearNavigationRoute: () => void;
  recalculateRoute: (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: RouteMode,
  ) => Promise<RouteResult | null>;
  autocomplete: (query: string) => Promise<AutocompleteSuggestion[]>;
  resolveSuggestion: (suggestion: AutocompleteSuggestion) => Promise<Place | null>;
};

export type AutocompleteSuggestion = {
  displayLines: string[];
  coordinate?: LatLng;
  raw?: unknown;
};

export type ECMapProps = {
  onPlaceSelect?: (place: Place) => void;
  onUserLocation?: (coord: { latitude: number; longitude: number }) => void;
  fallbackCenter?: LatLng;
  /**
   * AMap `city` param for transit routing (adcode or citycode). Ignored for
   * driving/walking. Defaults to Shanghai ("021").
   */
  cityCode?: string;
  poiCityCode?: string;
};
