import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { wgs84ToGcj02, isInsideMainlandChina } from "@/lib/geoDatum";

export type Place = {
  name?: string;
  formattedAddress?: string;
  coordinate?: { latitude: number; longitude: number };
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

export type AppleMapHandle = {
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
  coordinate?: { latitude: number; longitude: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
};

export type AppleMapProps = {
  onPlaceSelect?: (place: Place) => void;
  onUserLocation?: (coord: { latitude: number; longitude: number }) => void;
  /**
   * AMap `city` param for transit routing (adcode or citycode). Ignored for
   * driving/walking. Defaults to Shanghai ("021").
   */
  cityCode?: string;
};

declare global {
  interface Window {
    mapkit?: any;
    __mapkitInitialized?: boolean;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapkitApi = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapkitMap = any;

export const waitForMapkit = () =>
  new Promise<MapkitApi>((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.mapkit) resolve(window.mapkit);
      else if (Date.now() - startedAt > 10000) reject(new Error("MapKit JS did not load"));
      else window.setTimeout(check, 100);
    };
    check();
  });

const waitForVisibleContainer = (element: HTMLDivElement) =>
  new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) resolve();
      else if (attempts++ > 60) reject(new Error("Map container has no visible size"));
      else requestAnimationFrame(check);
    };
    check();
  });

export const initializeMapkit = (mapkit: MapkitApi) => {
  if (window.__mapkitInitialized) return;

  mapkit.init({
    authorizationCallback: async (done: (token: string) => void) => {
      try {
        const { data, error } = await supabase.functions.invoke("mapkit-token", { method: "GET" });
        if (error) throw error;
        const token = typeof data === "string" ? data : "";
        if (!token) throw new Error("MapKit token response was empty");
        done(token);
      } catch (e) {
        console.error("mapkit-token fetch failed", e);
      }
    },
  });

  window.__mapkitInitialized = true;
};

const AppleMap = forwardRef<AppleMapHandle, AppleMapProps>(({ onPlaceSelect, onUserLocation, cityCode = "021" }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cityCodeRef = useRef(cityCode);
  cityCodeRef.current = cityCode;
  const mapRef = useRef<MapkitMap | null>(null);
  const searchRef = useRef<MapkitApi | null>(null);
  const directionsRef = useRef<MapkitApi | null>(null);
  const routeOverlayRef = useRef<MapkitApi | null>(null);
  const userCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const userOverrideAnnotationRef = useRef<MapkitApi | null>(null);
  // Per-step layered route overlays + pulsing destination
  const navStepOverlaysRef = useRef<Array<{ glow: MapkitApi; casing: MapkitApi; fill: MapkitApi }>>([]);
  const navDestAnnRef = useRef<MapkitApi | null>(null);
  const navAnimFrameRef = useRef<number | null>(null);
  const navCurrentIdxRef = useRef<number>(0);
  const navDashOffsetRef = useRef<number>(0);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;
  const [status, setStatus] = useState("");
  const [, setIsLocating] = useState(false);

  const permissionDeniedRef = useRef(false);

  const fallbackToChina = () => {
    const map = mapRef.current;
    if (!map || !window.mapkit) return;
    try {
      map.region = new window.mapkit.CoordinateRegion(
        new window.mapkit.Coordinate(31.2304, 121.4737),
        new window.mapkit.CoordinateSpan(0.15, 0.15),
      );
    } catch {
      // ignore
    }
  };

  const requestLocation = (manual = true) => {
    if (!navigator.geolocation) {
      fallbackToChina();
      return;
    }
    setIsLocating(true);
    setStatus("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setStatus("");
        permissionDeniedRef.current = false;
        // Browser geolocation returns WGS-84. Apple's China tiles and Amap
        // both render on GCJ-02. Convert once here so every downstream
        // consumer (marker rendering, route origin, callers via
        // onUserLocation) sees GCJ-02 in-country.
        const rawCoord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const coord = wgs84ToGcj02(rawCoord);
        userCoordRef.current = coord;
        onUserLocationRef.current?.(coord);
        if (!mapRef.current || !window.mapkit) return;
        // Only recentre on the user when they are within the Shanghai metro region.
        // Outside that, keep the Shanghai default so tourists don't land on a
        // country/continent view.
        const inShanghai =
          coord.latitude >= 30.7 && coord.latitude <= 31.9 &&
          coord.longitude >= 120.9 && coord.longitude <= 122.1;
        if (manual || inShanghai) {
          mapRef.current.region = new window.mapkit.CoordinateRegion(
            new window.mapkit.Coordinate(coord.latitude, coord.longitude),
            new window.mapkit.CoordinateSpan(0.15, 0.15),
          );
        }
      },
      (err) => {
        setIsLocating(false);
        setStatus("");
        console.warn("geolocation failed", err);
        if (err.code === err.PERMISSION_DENIED) {
          permissionDeniedRef.current = true;
          if (manual) {
            // Lazy import to avoid circular and keep this file slim.
            import("sonner").then(({ toast }) =>
              toast("Allow location in your browser settings to recenter", {
                duration: 3500,
              }),
            );
          }
        }
        fallbackToChina();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const clearAnnotations = () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.annotations && map.annotations.length) {
      map.removeAnnotations(map.annotations);
    }
  };

  const deselectAll = () => {
    const map = mapRef.current;
    if (!map?.annotations) return;
    map.annotations.forEach((a: { selected?: boolean }) => {
      try {
        a.selected = false;
      } catch {
        // ignore — some annotations may be read-only
      }
    });
  };

  const clearRoute = () => {
    const map = mapRef.current;
    if (map && routeOverlayRef.current) {
      try {
        map.removeOverlay(routeOverlayRef.current);
      } catch {
        // ignore
      }
    }
    routeOverlayRef.current = null;
  };

  // ---------- Premium navigation route rendering ----------

  const ROUTE_COLORS = {
    glow: "#E63946",
    casing: "#B82836",
    fillCurrent: "#E63946",
    fillUpcoming: "#D63746",
  } as const;

  type StepStatus = "completed" | "current" | "upcoming";

  const buildLayerStyle = (
    status: StepStatus,
    layer: "glow" | "casing" | "fill",
    dashOffset = 0,
  ): MapkitApi => {
    const mapkit = window.mapkit;
    const mul = status === "completed" ? 0.3 : 1;
    if (layer === "glow") {
      return new mapkit.Style({
        lineWidth: 16,
        strokeColor: ROUTE_COLORS.glow,
        strokeOpacity: 0.18 * mul,
        lineCap: "round",
        lineJoin: "round",
      });
    }
    if (layer === "casing") {
      return new mapkit.Style({
        lineWidth: 10,
        strokeColor: ROUTE_COLORS.casing,
        strokeOpacity: 1 * mul,
        lineCap: "round",
        lineJoin: "round",
      });
    }
    // fill
    if (status === "current") {
      return new mapkit.Style({
        lineWidth: 7,
        strokeColor: ROUTE_COLORS.fillCurrent,
        strokeOpacity: 1,
        lineCap: "round",
        lineJoin: "round",
        lineDash: [12, 8],
        lineDashOffset: dashOffset,
      });
    }
    const color = status === "upcoming" ? ROUTE_COLORS.fillUpcoming : ROUTE_COLORS.fillCurrent;
    return new mapkit.Style({
      lineWidth: 7,
      strokeColor: color,
      strokeOpacity: 1 * mul,
      lineCap: "round",
      lineJoin: "round",
    });
  };

  const applyStepStyles = (currentIndex: number) => {
    const overlays = navStepOverlaysRef.current;
    overlays.forEach((layers, i) => {
      const status: StepStatus =
        i < currentIndex ? "completed" : i === currentIndex ? "current" : "upcoming";
      try {
        layers.glow.style = buildLayerStyle(status, "glow");
        layers.casing.style = buildLayerStyle(status, "casing");
        layers.fill.style = buildLayerStyle(status, "fill", navDashOffsetRef.current);
      } catch {
        // ignore
      }
    });
  };

  const ensurePulseStyleInjected = () => {
    if (document.getElementById("eazi-nav-dest-pulse-style")) return;
    const el = document.createElement("style");
    el.id = "eazi-nav-dest-pulse-style";
    el.textContent = `
@keyframes eaziNavDestPulse {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(2.5); opacity: 0; }
}
.eazi-nav-dest-pulse-ring {
  position: absolute; inset: 0; border-radius: 9999px;
  background: #E63946;
  animation: eaziNavDestPulse 1.8s ease-out infinite;
  will-change: transform, opacity;
}
.eazi-nav-dest-pulse-ring.delay { animation-delay: 0.9s; }
`;
    document.head.appendChild(el);
  };

  const startDashAnimation = () => {
    if (navAnimFrameRef.current != null) return;
    console.warn("[NAV] dash animation may be expensive");
    const tick = () => {
      // negative offset → dashes flow forward toward the destination
      navDashOffsetRef.current = (navDashOffsetRef.current - 1) % 1000;
      const cur = navStepOverlaysRef.current[navCurrentIdxRef.current];
      if (cur) {
        try {
          cur.fill.style = buildLayerStyle("current", "fill", navDashOffsetRef.current);
        } catch {
          // ignore
        }
      }
      navAnimFrameRef.current = requestAnimationFrame(tick);
    };
    navAnimFrameRef.current = requestAnimationFrame(tick);
  };

  const stopDashAnimation = () => {
    if (navAnimFrameRef.current != null) {
      cancelAnimationFrame(navAnimFrameRef.current);
      navAnimFrameRef.current = null;
    }
  };

  const removeNavStepOverlays = () => {
    const map = mapRef.current;
    if (!map) {
      navStepOverlaysRef.current = [];
      return;
    }
    for (const layers of navStepOverlaysRef.current) {
      for (const ov of [layers.glow, layers.casing, layers.fill]) {
        try {
          map.removeOverlay(ov);
        } catch {
          // ignore
        }
      }
    }
    navStepOverlaysRef.current = [];
  };

  const removeNavDestination = () => {
    const map = mapRef.current;
    if (map && navDestAnnRef.current) {
      try {
        map.removeAnnotation(navDestAnnRef.current);
      } catch {
        // ignore
      }
    }
    navDestAnnRef.current = null;
  };

  const buildPulsingDestination = (coord: { latitude: number; longitude: number }) => {
    const mapkit = window.mapkit;
    ensurePulseStyleInjected();
    const factory = () => {
      const wrap = document.createElement("div");
      wrap.style.cssText =
        "position:relative;width:28px;height:28px;pointer-events:none;";
      wrap.innerHTML = `
        <span class="eazi-nav-dest-pulse-ring"></span>
        <span class="eazi-nav-dest-pulse-ring delay"></span>
        <span style="position:absolute;inset:0;border-radius:9999px;background:#E63946;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);"></span>
      `;
      return wrap;
    };
    const ann = new mapkit.Annotation(
      new mapkit.Coordinate(coord.latitude, coord.longitude),
      factory,
      {
        displayPriority: 1000,
        calloutEnabled: false,
        anchorOffset: new DOMPoint(0, 0),
      },
    );
    ann.data = { isNavDestination: true };
    return ann;
  };

  const setNavigationRoute = (
    steps: RouteStep[],
    destination: { latitude: number; longitude: number },
  ) => {
    const map = mapRef.current;
    const mapkit = window.mapkit;
    if (!map || !mapkit) return;

    // Tear down anything from a previous nav session + the single-line route
    stopDashAnimation();
    removeNavStepOverlays();
    removeNavDestination();
    clearRoute();

    // Remove the static origin/destination markers left by showRoute()
    if (map.annotations?.length) {
      const toRemove = map.annotations.filter(
        (a: { data?: { isUserOverride?: boolean; isCluster?: boolean; isNavDestination?: boolean } }) =>
          !a.data?.isUserOverride && !a.data?.isCluster && !a.data?.isNavDestination,
      );
      if (toRemove.length) {
        try {
          map.removeAnnotations(toRemove);
        } catch {
          // ignore
        }
      }
    }

    navCurrentIdxRef.current = 0;
    navDashOffsetRef.current = 0;

    // Build 3 layered overlays per step (glow → casing → fill, back to front)
    const overlays: Array<{ glow: MapkitApi; casing: MapkitApi; fill: MapkitApi }> = [];
    steps.forEach((step, i) => {
      if (!step.path || step.path.length < 2) return;
      const points = step.path.map(
        (c) => new mapkit.Coordinate(c.latitude, c.longitude),
      );
      const status: StepStatus = i === 0 ? "current" : "upcoming";
      try {
        const glow = new mapkit.PolylineOverlay(points, {
          style: buildLayerStyle(status, "glow"),
        });
        const casing = new mapkit.PolylineOverlay(points, {
          style: buildLayerStyle(status, "casing"),
        });
        const fill = new mapkit.PolylineOverlay(points, {
          style: buildLayerStyle(status, "fill"),
        });
        map.addOverlay(glow);
        map.addOverlay(casing);
        map.addOverlay(fill);
        overlays.push({ glow, casing, fill });
      } catch (e) {
        console.warn("[NAV] failed to build step overlay", i, e);
      }
    });
    navStepOverlaysRef.current = overlays;

    // Pulsing destination marker
    try {
      const destAnn = buildPulsingDestination(destination);
      map.addAnnotation(destAnn);
      navDestAnnRef.current = destAnn;
    } catch (e) {
      console.warn("[NAV] failed to build pulsing destination", e);
    }

    // Kick off the dash flow animation on the current step
    startDashAnimation();
  };

  const updateNavigationStepIndex = (index: number) => {
    if (index === navCurrentIdxRef.current) return;
    navCurrentIdxRef.current = Math.max(
      0,
      Math.min(index, navStepOverlaysRef.current.length - 1),
    );
    applyStepStyles(navCurrentIdxRef.current);
  };

  const clearNavigationRoute = () => {
    stopDashAnimation();
    removeNavStepOverlays();
    removeNavDestination();
    navCurrentIdxRef.current = 0;
    navDashOffsetRef.current = 0;
  };

  // Cancel any in-flight rAF when the component unmounts
  useEffect(() => {
    return () => {
      stopDashAnimation();
    };
  }, []);

  // ---------- End premium navigation rendering ----------

  // ---------- Routing data source (Amap-first, Apple Directions fallback) ----------

  type AmapAdapted = {
    etaSec: number;
    distance: number;
    steps: RouteStep[];
    // Full-route geometry pre-converted to mapkit.Coordinate objects
    // (Amap returns [lng, lat]; MapKit consumes {latitude, longitude}).
    geometry: MapkitApi[];
  };

  const routeViaAmap = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: RouteMode,
  ): Promise<AmapAdapted | null> => {
    const mapkit = window.mapkit;
    if (!mapkit) return null;
    const amapMode = mode === "drive" ? "driving" : mode === "walk" ? "walking" : "transit";
    const body = {
      // Amap expects "lng,lat" strings, GCJ-02 datum. Origin/destination
      // reaching this helper are already GCJ-02: user coord was converted
      // in requestLocation; destination came from MapKit's China tiles
      // (already GCJ-02).
      origin: `${origin.longitude.toFixed(6)},${origin.latitude.toFixed(6)}`,
      destination: `${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`,
      mode: amapMode,
      city: cityCodeRef.current || "021",
    };
    try {
      const { data, error } = await supabase.functions.invoke("amap-route", { body });
      const payload = data as
        | {
            distance_m?: number;
            duration_s?: number;
            points?: Array<[number, number]>;
            steps?: Array<{
              instruction: string;
              distance_m: number;
              duration_s?: number;
              points?: Array<[number, number]>;
            }>;
            error?: string;
          }
        | null;
      if (error || !payload || payload.error) {
        console.warn(
          "[route] amap-route unavailable, falling back to Apple Directions",
          error ?? payload?.error,
        );
        return null;
      }
      const pts = payload.points ?? [];
      if (pts.length < 2) {
        console.warn("[route] amap-route returned no geometry, falling back");
        return null;
      }
      const geometry = pts.map(([lng, lat]) => new mapkit.Coordinate(lat, lng));
      const steps: RouteStep[] = (payload.steps ?? []).map((s) => ({
        instructions: s.instruction,
        distance: Number(s.distance_m ?? 0),
        path: (s.points ?? []).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      }));
      return {
        etaSec: Number(payload.duration_s ?? 0),
        distance: Number(payload.distance_m ?? 0),
        geometry,
        steps,
      };
    } catch (e) {
      console.warn("[route] amap-route threw, falling back to Apple Directions", e);
      return null;
    }
  };

  const routeViaApple = (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: RouteMode,
  ) =>
    new Promise<
      | ({
          etaSec: number;
          distance: number;
          steps: RouteStep[];
          geometry: unknown;
        })
      | null
    >((resolve) => {
      const mapkit = window.mapkit;
      if (!mapkit) {
        resolve(null);
        return;
      }
      if (!directionsRef.current) directionsRef.current = new mapkit.Directions();
      const transportType =
        mode === "drive"
          ? mapkit.Directions.Transport.Automobile
          : mode === "transit"
            ? mapkit.Directions.Transport.Transit
            : mapkit.Directions.Transport.Walking;
      try {
        directionsRef.current.route(
          {
            origin: new mapkit.Coordinate(origin.latitude, origin.longitude),
            destination: new mapkit.Coordinate(destination.latitude, destination.longitude),
            transportType,
          },
          (
            error: unknown,
            data: {
              routes?: Array<{
                expectedTravelTime: number;
                distance: number;
                steps: Array<{ instructions: string; distance: number }>;
                polyline?: unknown;
                geometry?: unknown;
                path?: unknown;
              }>;
            },
          ) => {
            if (error || !data?.routes?.length) {
              resolve(null);
              return;
            }
            const route = data.routes[0];
            resolve({
              etaSec: route.expectedTravelTime,
              distance: route.distance,
              geometry: route.polyline ?? route.geometry ?? route.path,
              steps: (route.steps ?? []).map((s) => {
                const raw = s as unknown as {
                  instructions: string;
                  distance: number;
                  path?: Array<{ latitude: number; longitude: number }>;
                  transportType?: string;
                };
                const path = Array.isArray(raw.path)
                  ? raw.path.map((c) => ({ latitude: c.latitude, longitude: c.longitude }))
                  : [];
                return {
                  instructions: raw.instructions,
                  distance: raw.distance,
                  path,
                  transportType: raw.transportType,
                };
              }),
            });
          },
        );
      } catch (e) {
        console.warn("[route] Apple Directions threw", e);
        resolve(null);
      }
    });

  const showRoute = async (place: Place, mode: RouteMode): Promise<RouteResult | null> => {
    const map = mapRef.current;
    const mapkit = window.mapkit;
    const coord = place.coordinate as { latitude: number; longitude: number } | undefined;
    const userCoord = userCoordRef.current;
    if (!map || !mapkit || !coord || !userCoord) return null;

    // Prefer Amap in mainland China (Apple Directions has no coverage there).
    const preferAmap = isInsideMainlandChina(userCoord) || isInsideMainlandChina(coord);
    const result = preferAmap
      ? (await routeViaAmap(userCoord, coord, mode)) ?? (await routeViaApple(userCoord, coord, mode))
      : await routeViaApple(userCoord, coord, mode);

    if (!result) return null;

    clearRoute();
    if (result.geometry) {
      try {
        const style = new mapkit.Style({ lineWidth: 5, strokeColor: "#E63946" });
        routeOverlayRef.current = new mapkit.PolylineOverlay(result.geometry, { style });
        map.addOverlay(routeOverlayRef.current);
      } catch (e) {
        console.warn("route overlay failed", e);
      }
    }
    try {
      const originAnn = new mapkit.MarkerAnnotation(
        new mapkit.Coordinate(userCoord.latitude, userCoord.longitude),
        { color: "#1A1A1A", glyphText: "•" },
      );
      const destAnn = new mapkit.MarkerAnnotation(
        new mapkit.Coordinate(coord.latitude, coord.longitude),
        { color: "#E63946" },
      );
      try {
        const padding = new mapkit.Padding({
          top: 96,
          right: 32,
          bottom: Math.round(window.innerHeight * 0.55),
          left: 32,
        });
        map.showItems([originAnn, destAnn], { animate: true, padding });
      } catch {
        map.showItems([originAnn, destAnn], { animate: true });
      }
    } catch {
      // ignore
    }
    return { etaSec: result.etaSec, distance: result.distance, steps: result.steps };
  };

  // Legacy showRoute (Apple-only) retained here as a comment marker so future
  // readers can locate the pre-Amap implementation via git history.

  const search = (
    query: string,
    options?: { glyphText?: string; clusterId?: string; color?: string },
  ) =>
    new Promise<number>((resolve) => {
      const map = mapRef.current;
      const mapkit = window.mapkit;
      if (!map || !mapkit || !query.trim()) {
        resolve(0);
        return;
      }
      if (!searchRef.current) {
        searchRef.current = new mapkit.Search({ getsUserLocation: true, region: map.region });
      } else {
        try {
          searchRef.current.region = map.region;
        } catch {
          // region setter may not exist in all versions; ignore
        }
      }
      searchRef.current.search(query, (error: unknown, data: { places?: Place[] }) => {
        if (error || !data?.places) {
          clearAnnotations();
          resolve(0);
          return;
        }
        clearAnnotations();
        if (data.places.length === 0) {
          resolve(0);
          return;
        }
        const glyphText = options?.glyphText;
        const clusterId = options?.clusterId ?? "search-results";
        const pinColor = options?.color ?? "#1A1A1A";
        const annotations = data.places.map((place) => {
          const coord = place.coordinate as { latitude: number; longitude: number };
          const annotation = new mapkit.MarkerAnnotation(
            new mapkit.Coordinate(coord.latitude, coord.longitude),
            {
              color: pinColor,
              glyphColor: "white",
              calloutEnabled: false,
              displayPriority: 1000,
              animates: false,
              clusteringIdentifier: clusterId,
              ...(glyphText ? { glyphText } : {}),
            },
          );
          try {
            annotation.callout = { calloutEnabledForAnnotation: () => false };
          } catch {
            // ignore
          }
          annotation.data = { place };
          return annotation;
        });
        map.showItems(annotations);
        resolve(annotations.length);
      });
    });

  useImperativeHandle(ref, () => ({
    recenter: () => requestLocation(true),
    search,
    clearAnnotations,
    deselectAll,
    showRoute,
    clearRoute,
    centerOn: (lat: number, lng: number, distance = 2000) => {
      const map = mapRef.current;
      if (!map || !window.mapkit) return;
      map.setCenterAnimated(new window.mapkit.Coordinate(lat, lng));
      try {
        map.cameraDistance = distance;
      } catch {
        // ignore
      }
    },
    showSinglePlace: (place: Place, glyphText?: string, color?: string) => {
      const map = mapRef.current;
      const mapkit = window.mapkit;
      const coord = place.coordinate as { latitude: number; longitude: number } | undefined;
      if (!map || !mapkit || !coord) return;
      clearAnnotations();
      const annotation = new mapkit.MarkerAnnotation(
        new mapkit.Coordinate(coord.latitude, coord.longitude),
        {
          color: color ?? "#1A1A1A",
          glyphColor: "white",
          calloutEnabled: false,
          displayPriority: 1000,
          animates: false,
          ...(glyphText ? { glyphText } : {}),
        },
      );
      annotation.data = { place };
      map.showItems([annotation], { animate: true });
    },
    setCenterAnimated: (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map || !window.mapkit) return;
      try {
        map.setCenterAnimated(new window.mapkit.Coordinate(lat, lng), true);
      } catch {
        // ignore
      }
    },
    setCameraDistance: (distance: number) => {
      const map = mapRef.current;
      if (!map) return;
      try {
        map.cameraDistance = distance;
      } catch {
        // ignore
      }
    },
    setRotation: (degrees: number) => {
      const map = mapRef.current;
      if (!map) return;
      try {
        map.rotation = degrees;
      } catch {
        // ignore — rotation may be disabled
      }
    },
    setShowsUserLocation: (visible: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      try {
        map.showsUserLocation = visible;
      } catch {
        // ignore
      }
    },
    setUserOverrideLocation: (coord) => {
      const map = mapRef.current;
      const mapkit = window.mapkit;
      if (!map || !mapkit) return;
      if (!coord) {
        if (userOverrideAnnotationRef.current) {
          try {
            map.removeAnnotation(userOverrideAnnotationRef.current);
          } catch {
            // ignore
          }
          userOverrideAnnotationRef.current = null;
        }
        return;
      }
      const mkCoord = new mapkit.Coordinate(coord.latitude, coord.longitude);
      if (userOverrideAnnotationRef.current) {
        try {
          userOverrideAnnotationRef.current.coordinate = mkCoord;
          return;
        } catch {
          // fall through to recreate
        }
      }
      try {
        const factory = () => {
          const el = document.createElement("div");
          el.style.cssText =
            "width:18px;height:18px;border-radius:9999px;background:#1976FF;border:3px solid #fff;box-shadow:0 0 0 4px rgba(25,118,255,0.18),0 2px 6px rgba(0,0,0,0.25);";
          return el;
        };
        const ann = new mapkit.Annotation(mkCoord, factory, {
          displayPriority: 1000,
          calloutEnabled: false,
          anchorOffset: new DOMPoint(0, 0),
        });
        ann.data = { isUserOverride: true };
        map.addAnnotation(ann);
        userOverrideAnnotationRef.current = ann;
      } catch (e) {
        console.warn("user override annotation failed", e);
      }
    },
    setNavigationRoute,
    updateNavigationStepIndex,
    clearNavigationRoute,
    recalculateRoute: async (origin, destination, mode) => {
      const preferAmap =
        isInsideMainlandChina(origin) || isInsideMainlandChina(destination);
      const result = preferAmap
        ? (await routeViaAmap(origin, destination, mode)) ??
          (await routeViaApple(origin, destination, mode))
        : await routeViaApple(origin, destination, mode);
      if (!result) return null;
      return {
        etaSec: result.etaSec,
        distance: result.distance,
        steps: result.steps,
      };
    },
    autocomplete: (query: string) =>
      new Promise<AutocompleteSuggestion[]>((resolve) => {
        const map = mapRef.current;
        const mapkit = window.mapkit;
        if (!map || !mapkit || !query.trim()) {
          resolve([]);
          return;
        }
        if (!searchRef.current) {
          searchRef.current = new mapkit.Search({ getsUserLocation: true, region: map.region });
        } else {
          try {
            searchRef.current.region = map.region;
          } catch {
            // ignore
          }
        }
        try {
          searchRef.current.autocomplete(
            query,
            (
              error: unknown,
              data: {
                results?: Array<{
                  displayLines?: string[];
                  coordinate?: { latitude: number; longitude: number };
                }>;
              },
            ) => {
              if (error || !data?.results) {
                resolve([]);
                return;
              }
              resolve(
                data.results.map((r) => ({
                  displayLines: r.displayLines ?? [],
                  coordinate: r.coordinate,
                  raw: r,
                })),
              );
            },
            { region: map.region },
          );
        } catch (e) {
          console.warn("autocomplete failed", e);
          resolve([]);
        }
      }),
    resolveSuggestion: (suggestion: AutocompleteSuggestion) =>
      new Promise<Place | null>((resolve) => {
        const map = mapRef.current;
        const mapkit = window.mapkit;
        if (!map || !mapkit) {
          resolve(null);
          return;
        }
        // If coordinate already on the suggestion, build a Place directly.
        if (suggestion.coordinate) {
          resolve({
            name: suggestion.displayLines[0],
            formattedAddress:
              suggestion.displayLines.slice(1).join(", ") || suggestion.displayLines[0],
            coordinate: suggestion.coordinate,
          });
          return;
        }
        if (!searchRef.current) {
          searchRef.current = new mapkit.Search({ getsUserLocation: true, region: map.region });
        }
        const query = suggestion.displayLines.join(", ") || suggestion.displayLines[0] || "";
        try {
          searchRef.current.search(
            query,
            (error: unknown, data: { places?: Place[] }) => {
              if (error || !data?.places?.length) {
                resolve(null);
                return;
              }
              resolve(data.places[0]);
            },
          );
        } catch {
          resolve(null);
        }
      }),
  }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mapkit = await waitForMapkit();
        if (!containerRef.current || cancelled) return;

        initializeMapkit(mapkit);
        await waitForVisibleContainer(containerRef.current);
        if (!containerRef.current || cancelled) return;

        mapRef.current = new mapkit.Map(containerRef.current, {
          region: new mapkit.CoordinateRegion(
            new mapkit.Coordinate(31.2304, 121.4737),
            new mapkit.CoordinateSpan(0.15, 0.15),
          ),
          showsUserLocation: true,
          showsZoomControl: false,
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isRotationEnabled: false,
          padding: new mapkit.Padding({ top: 16, right: 16, bottom: 88, left: 16 }),
        });
        mapRef.current.padding = new mapkit.Padding({ top: 16, right: 16, bottom: 88, left: 16 });
        setStatus("");

        // Custom cluster annotation: brand-red circular badge with white count.
        mapRef.current.annotationForCluster = (clusterAnnotation: {
          memberAnnotations: Array<{ coordinate: unknown }>;
          coordinate: unknown;
        }) => {
          const count = clusterAnnotation.memberAnnotations.length;
          const factory = () => {
            const el = document.createElement("div");
            el.style.cssText =
              "width:40px;height:40px;border-radius:9999px;background:#E63946;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.18);border:2px solid #fff;";
            el.textContent = String(count);
            return el;
          };
          const cluster = new mapkit.Annotation(clusterAnnotation.coordinate, factory, {
            displayPriority: 1000,
            calloutEnabled: false,
          });
          cluster.data = { isCluster: true, members: clusterAnnotation.memberAnnotations };
          return cluster;
        };

        mapRef.current.addEventListener("select", (event: { annotation?: { data?: { place?: Place; isCluster?: boolean; members?: Array<{ coordinate: unknown }> } } }) => {
          const data = event.annotation?.data;
          if (!data) return;
          if (data.isCluster && data.members?.length) {
            mapRef.current?.showItems(data.members, { animate: true });
            return;
          }
          if (data.place && onPlaceSelectRef.current) {
            console.log("Selected place:", data.place);
            onPlaceSelectRef.current(data.place);
          }
        });

        requestLocation(false);
      } catch (e) {
        if (!cancelled) {
          console.error("MapKit setup failed", e);
          setStatus("Map failed to load");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        mapRef.current?.destroy?.();
      } catch {
        // MapKit may already have cleaned up the instance during hot reload.
      }
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#f0f0f0",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {status && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 14,
            color: "#555",
            zIndex: 1,
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
});

AppleMap.displayName = "AppleMap";

export default AppleMap;