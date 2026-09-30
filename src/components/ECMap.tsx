import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { isCapacitorApp } from "@/integrations/capacitor";
import { getCurrentLocation, isLocationPermissionDenied, watchLocation } from "@/integrations/capacitor/geolocation";
import { wgs84ToGcj02, type LatLng } from "@/lib/geoDatum";
import { resolveAmapSuggestion, searchAmapPlaces, searchAmapSuggestions } from "@/lib/amapPoiSearch";
import { calculateMapRoute } from "@/lib/mapRouting";
import { MapTilerView } from "@/lib/mapTilerView";
import type { ECMapHandle, ECMapProps, Place, RouteMode } from "@/lib/mapTypes";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import "./ECMap.css";

export type {
  ECMapHandle, ECMapProps, AutocompleteSuggestion, Place, RouteMode, RouteResult, RouteStep,
} from "@/lib/mapTypes";

// Accept a recent network fix quickly; the active watch can refine it later.
const INITIAL_LOCATION_OPTIONS = { enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60 * 1000 };
const RECENTER_LOCATION_OPTIONS = { enableHighAccuracy: false, timeout: 45000, maximumAge: 5 * 60 * 1000 };
const FRESH_LOCATION_AGE_MS = 60000;

const locationErrorMessage = (error: unknown): string => {
  if (isLocationPermissionDenied(error)) {
    return `Allow location in your ${isCapacitorApp() ? "device" : "browser"} settings to recenter`;
  }
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "OS-PLUG-GLOC-0007" || code === "OS-PLUG-GLOC-0009" || code === "OS-PLUG-GLOC-0017") {
    return "Turn on Location Services on your device to recenter.";
  }
  if (code === 3 || code === "OS-PLUG-GLOC-0010") {
    return "Location timed out. Check Location Services and try again outdoors.";
  }
  return "Couldn't get your location. Please try again.";
};

// Retain the existing component contract while using MapTiler for all rendering.
const ECMap = forwardRef<ECMapHandle, ECMapProps>(({ onPlaceSelect, onUserLocation, fallbackCenter, cityCode = "021", poiCityCode }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapTilerView | null>(null);
  const viewReadyRef = useRef<Promise<MapTilerView> | null>(null);
  const cityCodeRef = useRef(cityCode);
  cityCodeRef.current = cityCode;
  const poiCityCodeRef = useRef(poiCityCode);
  poiCityCodeRef.current = poiCityCode;
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;
  const fallbackCenterRef = useRef(fallbackCenter);
  fallbackCenterRef.current = fallbackCenter;
  const userCoordRef = useRef<LatLng | null>(null);
  const lastLocationAtRef = useRef(0);
  const recenterOnNextLocationRef = useRef(false);
  const locationRequestRef = useRef<Promise<void> | null>(null);
  const locationVersionRef = useRef(0);
  const routeVersionRef = useRef(0);
  const searchControllerRef = useRef<AbortController | null>(null);
  const startLocationWatchRef = useRef<() => void>(null);
  const stopLocationWatchRef = useRef<(() => void) | null>(null);
  const userLocationVisibleRef = useRef(true);
  const [status, setStatus] = useState("Loading map…");
  const [canRetry, setCanRetry] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const getView = async (): Promise<MapTilerView | null> => {
    try {
      const view = await viewReadyRef.current;
      return view && viewRef.current === view ? view : null;
    } catch {
      return null;
    }
  };

  const withView = (action: (view: MapTilerView) => void) => {
    void getView().then((view) => { if (view) action(view); });
  };

  const cancelSearch = () => {
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
  };

  const startLocationWatch = () => {
    const view = viewRef.current;
    if (!view || !userLocationVisibleRef.current || stopLocationWatchRef.current) return;
    stopLocationWatchRef.current = watchLocation((position) => {
      if (viewRef.current !== view) return;
      const { latitude, longitude } = position.coords;
      const coordinate = wgs84ToGcj02({ latitude, longitude });
      userCoordRef.current = coordinate;
      lastLocationAtRef.current = Date.now();
      view.setUserLocation(coordinate);
      onUserLocationRef.current?.(coordinate);
      if (recenterOnNextLocationRef.current) {
        recenterOnNextLocationRef.current = false;
        view.centerOn(coordinate, 8000);
      }
    }, (error) => console.warn("Location update failed", error), { timeout: 45000 });
  };
  startLocationWatchRef.current = startLocationWatch;

  const requestLocation = (): Promise<void> => {
    if (locationRequestRef.current) return locationRequestRef.current;
    const request = (async () => {
      const view = await getView();
      if (!view) return;
      if (userCoordRef.current && Date.now() - lastLocationAtRef.current < FRESH_LOCATION_AGE_MS) {
        view.centerOn(userCoordRef.current, 8000);
        return;
      }
      const version = ++locationVersionRef.current;
      try {
        const position = await getCurrentLocation(RECENTER_LOCATION_OPTIONS);
        if (version !== locationVersionRef.current || viewRef.current !== view) return;
        const { latitude, longitude } = position.coords;
        const coordinate = wgs84ToGcj02({ latitude, longitude });
        userCoordRef.current = coordinate;
        lastLocationAtRef.current = Date.now();
        recenterOnNextLocationRef.current = false;
        view.setUserLocation(coordinate);
        onUserLocationRef.current?.(coordinate);
        view.centerOn(coordinate, 8000);
        stopLocationWatchRef.current?.();
        stopLocationWatchRef.current = null;
        startLocationWatch();
      } catch (error) {
        if (version !== locationVersionRef.current || viewRef.current !== view) return;
        console.warn("Location request failed", error);
        if (userCoordRef.current && Date.now() - lastLocationAtRef.current < FRESH_LOCATION_AGE_MS) {
          view.centerOn(userCoordRef.current, 8000);
        } else {
          toast(locationErrorMessage(error));
        }
      }
    })();
    locationRequestRef.current = request;
    const clearRequest = () => { if (locationRequestRef.current === request) locationRequestRef.current = null; };
    void request.then(clearRequest, clearRequest);
    return request;
  };

  const showRoute = async (place: Place, mode: RouteMode) => {
    const version = ++routeVersionRef.current;
    const view = await getView();
    if (!view || !place.coordinate) return null;
    if (!userCoordRef.current) await requestLocation();
    const origin = userCoordRef.current;
    if (!origin || version !== routeVersionRef.current) return null;
    const result = await calculateMapRoute(origin, place.coordinate, mode, cityCodeRef.current);
    if (!result || version !== routeVersionRef.current || viewRef.current !== view) return null;
    view.setRoute(result.geometry, origin, place.coordinate);
    return { etaSec: result.etaSec, distance: result.distance, steps: result.steps };
  };

  useImperativeHandle(ref, () => ({
    recenter: () => { void requestLocation(); },
    search: async (query, options) => {
      cancelSearch();
      const controller = new AbortController();
      searchControllerRef.current = controller;
      const view = await getView();
      if (!view || !query.trim() || controller.signal.aborted) return 0;
      const region = view.getRegion();
      const center = { latitude: region.latitude, longitude: region.longitude };
      const radius = Math.min(50000, Math.max(1500,
        Math.round(Math.hypot(region.latitudeDelta * 111000, region.longitudeDelta * 111000 * Math.cos(center.latitude * Math.PI / 180)) / 2),
      ));
      const places = await searchAmapPlaces(query, { center, radius, signal: controller.signal });
      if (controller.signal.aborted || viewRef.current !== view) return 0;
      view.setPlaces(places, options);
      return places.filter((place) => place.coordinate).length;
    },
    clearAnnotations: () => { cancelSearch(); withView((view) => view.setPlaces([], {}, false)); },
    deselectAll: () => withView((view) => view.deselectAll()),
    showRoute,
    clearRoute: () => { routeVersionRef.current++; withView((view) => view.clearRoute()); },
    centerOn: (latitude, longitude, distance = 2000) => withView((view) => view.centerOn({ latitude, longitude }, distance)),
    showSinglePlace: (place, glyphText, color) => {
      cancelSearch();
      withView((view) => view.setPlaces([place], { glyphText, color }));
    },
    setCenterAnimated: (latitude, longitude) => withView((view) => view.centerOn({ latitude, longitude })),
    setCameraDistance: (distance) => withView((view) => view.setCameraDistance(distance)),
    setRotation: (degrees) => withView((view) => view.setRotation(degrees)),
    setShowsUserLocation: (visible) => {
      userLocationVisibleRef.current = visible;
      if (!visible) {
        stopLocationWatchRef.current?.();
        stopLocationWatchRef.current = null;
      }
      withView((view) => {
        view.setShowsUserLocation(visible);
        if (visible) startLocationWatchRef.current?.();
      });
    },
    setUserOverrideLocation: (coordinate) => withView((view) => view.setUserOverrideLocation(coordinate)),
    setNavigationRoute: (steps, destination) => {
      routeVersionRef.current++;
      cancelSearch();
      withView((view) => view.setNavigationRoute(steps, destination));
    },
    updateNavigationStepIndex: (index) => withView((view) => view.updateNavigationStepIndex(index)),
    clearNavigationRoute: () => { routeVersionRef.current++; withView((view) => view.clearNavigationRoute()); },
    recalculateRoute: async (origin, destination, mode) => {
      const result = await calculateMapRoute(origin, destination, mode, cityCodeRef.current);
      return result ? { etaSec: result.etaSec, distance: result.distance, steps: result.steps } : null;
    },
    autocomplete: (query) => {
      const region = viewRef.current?.getRegion();
      if (!region) return Promise.resolve([]);
      const center = { latitude: region.latitude, longitude: region.longitude };
      const selectedCenter = fallbackCenterRef.current;
      const distanceFromSelectedCity = selectedCenter && Math.hypot(
        (center.latitude - selectedCenter.latitude) * 111000,
        (center.longitude - selectedCenter.longitude) * 111000 * Math.cos(center.latitude * Math.PI / 180),
      );
      const city = distanceFromSelectedCity !== undefined && distanceFromSelectedCity < 50000
        ? poiCityCodeRef.current : undefined;
      return searchAmapSuggestions(query, { center, city });
    },
    resolveSuggestion: resolveAmapSuggestion,
  }));

  useEffect(() => {
    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim();
    if (!apiKey) {
      console.warn("Set VITE_MAPTILER_API_KEY to enable maps");
      setStatus("Map is currently unavailable.");
      setCanRetry(false);
      return;
    }
    let cancelled = false;
    let view: MapTilerView | null = null;
    let observer: ResizeObserver | null = null;
    setStatus("Finding your location…");
    setCanRetry(false);

    const initialization = (async () => {
      const [sdk, location] = await Promise.all([
        import("@maptiler/sdk"),
        getCurrentLocation(INITIAL_LOCATION_OPTIONS).then(
          (position) => ({ position, error: null as unknown }),
          (error: unknown) => ({ position: null, error }),
        ),
      ]);
      if (cancelled || !containerRef.current) throw new Error("Map was closed");
      if (location.error) console.warn("Initial location unavailable", location.error);
      const coordinate = location.position
        ? wgs84ToGcj02({ latitude: location.position.coords.latitude, longitude: location.position.coords.longitude })
        : fallbackCenterRef.current ?? { latitude: 20, longitude: 0 };
      setStatus("Loading map…");
      view = new MapTilerView(
        sdk, containerRef.current, apiKey, (place) => onPlaceSelectRef.current?.(place),
        coordinate, location.position ? 14 : fallbackCenterRef.current ? 12 : 2,
      );
      viewRef.current = view;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => view?.resize());
        observer.observe(containerRef.current);
      }
      await view.ready;
      if (cancelled) throw new Error("Map was closed");
      if (location.position) {
        userCoordRef.current = coordinate;
        lastLocationAtRef.current = Date.now();
        view.setUserLocation(coordinate);
        onUserLocationRef.current?.(coordinate);
      } else {
        recenterOnNextLocationRef.current = true;
      }
      startLocationWatchRef.current?.();
      setStatus("");
      return view;
    })();
    viewReadyRef.current = initialization;
    void initialization.catch((error: unknown) => {
      if (cancelled) return;
      observer?.disconnect();
      view?.destroy();
      viewRef.current = null;
      console.error("MapTiler setup failed", error);
      setStatus("Map could not load. Please try again.");
      setCanRetry(true);
    });

    return () => {
      cancelled = true;
      recenterOnNextLocationRef.current = false;
      searchControllerRef.current?.abort();
      stopLocationWatchRef.current?.();
      stopLocationWatchRef.current = null;
      observer?.disconnect();
      view?.destroy();
      viewRef.current = null;
      viewReadyRef.current = null;
    };
  }, [attempt]);

  return (
    <div className="eazi-map">
      <div ref={containerRef} className="eazi-map-container" />
      {status && <div className="eazi-map-status" role="status">
        <div>
          <p>{status}</p>
          {canRetry && <button type="button" className="mt-3 rounded-full bg-white px-4 py-2 shadow-sm pointer-events-auto"
            onClick={() => setAttempt((value) => value + 1)}>Retry</button>}
        </div>
      </div>}
    </div>
  );
});

ECMap.displayName = "ECMap";
export default ECMap;
