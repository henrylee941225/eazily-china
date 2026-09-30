import type { FeatureCollection, LineString, Point } from "geojson";
import type { EaseToOptions, GeoJSONSource, Map as SdkMap, Marker } from "@maptiler/sdk";
import { wgs84ToGcj02, type LatLng } from "@/lib/geoDatum";
import { navigationFeatures, toMapTilerCoordinate, zoomForCameraDistance } from "@/lib/mapCoordinates";
import type { Place, Region, RouteStep } from "@/lib/mapTypes";

type Sdk = typeof import("@maptiler/sdk");
type PinOptions = { glyphText?: string; color?: string; clusterId?: string };
type PlaceFeatures = FeatureCollection<Point, { placeIndex: number; glyph: string; color: string }>;

const PLACES = "eazi-places";
const CLUSTERS = "eazi-clusters";
const PINS = "eazi-pins";
const ROUTE = "eazi-route";
const NAVIGATION = "eazi-navigation";
const EMPTY_PLACES: PlaceFeatures = { type: "FeatureCollection", features: [] };
const EMPTY_LINES: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] };

/** Owns renderer resources; public coordinates retain the existing app datum. */
export class MapTilerView {
  readonly map: SdkMap;
  readonly ready: Promise<void>;
  private disposed = false;
  private loaded = false;
  private places: Place[] = [];
  private placeData = EMPTY_PLACES;
  private selectedIndex: number | null = null;
  private userMarker: Marker | null = null;
  private overrideMarker: Marker | null = null;
  private destinationMarker: Marker | null = null;
  private routeData = EMPTY_LINES;
  private navigationData = EMPTY_LINES;
  private currentStepIndex = 0;
  private userVisible = true;
  private pendingCamera: EaseToOptions | null = null;
  private cameraQueued = false;
  private rejectReady: (error: Error) => void;
  private loadTimeout: ReturnType<typeof setTimeout>;

  constructor(
    private sdk: Sdk,
    container: HTMLDivElement,
    apiKey: string,
    onPlaceSelect: (place: Place) => void,
    initialCenter: LatLng,
    initialZoom: number,
  ) {
    this.map = new sdk.Map({
      container,
      apiKey,
      style: import.meta.env.VITE_MAPTILER_STYLE || sdk.MapStyle.STREETS,
      center: toMapTilerCoordinate(initialCenter),
      zoom: initialZoom,
      language: sdk.Language.ENGLISH,
      projection: "mercator",
      navigationControl: false,
      geolocateControl: false,
      geolocate: false,
      dragRotate: false,
      touchZoomRotate: true,
      attributionControl: { compact: true },
    });
    this.map.touchZoomRotate.disableRotation();
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      this.loadTimeout = setTimeout(() => reject(new Error("Map loading timed out")), 20000);
      this.map.on("load", () => {
        if (this.disposed) return;
        try {
          this.initializeLayers();
          this.loaded = true;
          clearTimeout(this.loadTimeout);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.map.on("error", ({ error }) => {
        if (!this.loaded && !this.disposed) reject(error);
      });
    });

    this.map.on("click", PINS, (event) => {
      const index = Number(event.features?.[0]?.properties?.placeIndex);
      const place = this.places[index];
      if (!place) return;
      this.deselectAll();
      this.selectedIndex = index;
      this.map.setFeatureState({ source: PLACES, id: index }, { selected: true });
      onPlaceSelect(place);
    });
    this.map.on("click", CLUSTERS, (event) => {
      const feature = event.features?.[0];
      if (feature?.geometry.type !== "Point") return;
      const clusterId = Number(feature.properties?.cluster_id);
      const center = feature.geometry.coordinates as [number, number];
      const source = this.map.getSource(PLACES) as GeoJSONSource;
      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (!this.disposed) this.map.easeTo({ center, zoom, duration: 350 });
      }).catch((error) => console.warn("Cluster expansion failed", error));
    });
    for (const layer of [PINS, CLUSTERS]) {
      this.map.on("mouseenter", layer, () => { this.map.getCanvas().style.cursor = "pointer"; });
      this.map.on("mouseleave", layer, () => { this.map.getCanvas().style.cursor = ""; });
    }
  }

  private initializeLayers(): void {
    const map = this.map;
    map.addSource(PLACES, { type: "geojson", data: this.placeData, cluster: true, clusterRadius: 45, clusterMaxZoom: 16 });
    map.addLayer({
      id: CLUSTERS, type: "circle", source: PLACES, filter: ["has", "point_count"],
      paint: { "circle-color": "#E63946", "circle-radius": 20, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
    });
    map.addLayer({
      id: "eazi-cluster-labels", type: "symbol", source: PLACES, filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14 },
      paint: { "text-color": "#fff" },
    });
    map.addLayer({
      id: PINS, type: "circle", source: PLACES, filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"], "circle-radius": 15,
        "circle-stroke-color": "#fff",
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 2],
      },
    });
    map.addLayer({
      id: "eazi-pin-labels", type: "symbol", source: PLACES, filter: ["!", ["has", "point_count"]],
      layout: { "text-field": ["get", "glyph"], "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": "#fff" },
    });
    map.addSource(ROUTE, { type: "geojson", data: this.routeData });
    map.addLayer({
      id: ROUTE, type: "line", source: ROUTE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#E63946", "line-width": 5 },
    }, CLUSTERS);
    map.addSource(NAVIGATION, { type: "geojson", data: this.navigationData });
    for (const [suffix, color, width, opacity] of [
      ["glow", "#E63946", 16, 0.18], ["casing", "#B82836", 10, 1], ["fill", "#E63946", 7, 1],
    ] as const) {
      map.addLayer({
        id: `${NAVIGATION}-${suffix}`, type: "line", source: NAVIGATION,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": color, "line-width": width, "line-opacity": opacity },
      }, CLUSTERS);
    }
    map.addLayer({
      id: `${NAVIGATION}-current`, type: "line", source: NAVIGATION,
      filter: ["==", ["get", "stepIndex"], this.currentStepIndex],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fff", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.6 },
    }, CLUSTERS);
    this.applyStepStyles();
  }

  getRegion(): Region {
    const center = this.map.getCenter();
    const coordinate = wgs84ToGcj02({ latitude: center.lat, longitude: center.lng });
    const bounds = this.map.getBounds();
    return {
      ...coordinate,
      latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
      longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
    };
  }

  setPlaces(places: Place[], options: PinOptions = {}, fit = true): void {
    this.deselectAll();
    this.places = places.filter((place) => !!place.coordinate);
    this.placeData = {
      type: "FeatureCollection",
      features: this.places.map((place, placeIndex) => ({
        type: "Feature", id: placeIndex,
        properties: { placeIndex, glyph: options.glyphText ?? "•", color: options.color ?? "#1A1A1A" },
        geometry: { type: "Point", coordinates: toMapTilerCoordinate(place.coordinate) },
      })),
    };
    if (this.loaded) (this.map.getSource(PLACES) as GeoJSONSource).setData(this.placeData);
    if (fit && this.places.length) this.fitCoordinates(this.places.map((place) => place.coordinate));
  }

  deselectAll(): void {
    if (this.loaded && this.selectedIndex !== null) {
      this.map.setFeatureState({ source: PLACES, id: this.selectedIndex }, { selected: false });
    }
    this.selectedIndex = null;
  }

  setRoute(geometry: LatLng[], origin: LatLng, destination: LatLng): void {
    this.clearNavigationRoute();
    this.routeData = geometry.length < 2 ? EMPTY_LINES : {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: geometry.map(toMapTilerCoordinate) } }],
    };
    if (this.loaded) (this.map.getSource(ROUTE) as GeoJSONSource).setData(this.routeData);
    this.setDestination(destination, false);
    this.fitCoordinates(geometry.length > 1 ? geometry : [origin, destination], true);
  }

  clearRoute(): void {
    this.routeData = EMPTY_LINES;
    if (this.loaded) (this.map.getSource(ROUTE) as GeoJSONSource).setData(EMPTY_LINES);
    if (!this.navigationData.features.length) this.removeDestination();
  }

  setNavigationRoute(steps: RouteStep[], destination: LatLng): void {
    this.clearRoute();
    this.setPlaces([], {}, false);
    this.currentStepIndex = 0;
    this.navigationData = navigationFeatures(steps);
    if (this.loaded) (this.map.getSource(NAVIGATION) as GeoJSONSource).setData(this.navigationData);
    this.applyStepStyles();
    this.setDestination(destination, true);
  }

  updateNavigationStepIndex(index: number): void {
    this.currentStepIndex = Math.max(0, index);
    if (this.loaded) this.applyStepStyles();
  }

  private applyStepStyles(): void {
    for (const suffix of ["glow", "casing", "fill"]) {
      const opacity = suffix === "glow" ? 0.18 : 1;
      this.map.setPaintProperty(`${NAVIGATION}-${suffix}`, "line-opacity", [
        "case", ["<", ["get", "stepIndex"], this.currentStepIndex], opacity * 0.3, opacity,
      ]);
    }
    this.map.setFilter(`${NAVIGATION}-current`, ["==", ["get", "stepIndex"], this.currentStepIndex]);
  }

  clearNavigationRoute(): void {
    this.navigationData = EMPTY_LINES;
    if (this.loaded) (this.map.getSource(NAVIGATION) as GeoJSONSource).setData(EMPTY_LINES);
    this.removeDestination();
  }

  setUserLocation(coordinate: LatLng): void {
    if (!this.userMarker) this.userMarker = this.createUserMarker();
    this.userMarker.setLngLat(toMapTilerCoordinate(coordinate));
    this.setShowsUserLocation(this.userVisible);
  }

  setShowsUserLocation(visible: boolean): void {
    this.userVisible = visible;
    if (this.userMarker) this.userMarker.getElement().style.display = visible ? "" : "none";
  }

  setUserOverrideLocation(coordinate: LatLng | null): void {
    if (!coordinate) {
      this.overrideMarker?.remove();
      this.overrideMarker = null;
      return;
    }
    if (!this.overrideMarker) this.overrideMarker = this.createUserMarker();
    this.overrideMarker.setLngLat(toMapTilerCoordinate(coordinate));
  }

  private createUserMarker(): Marker {
    const element = document.createElement("div");
    element.className = "eazi-map-user-dot";
    return new this.sdk.Marker({ element }).setLngLat([0, 0]).addTo(this.map);
  }

  private setDestination(coordinate: LatLng, pulsing: boolean): void {
    this.removeDestination();
    const element = document.createElement("div");
    element.className = `eazi-map-destination${pulsing ? " eazi-map-destination-pulse" : ""}`;
    this.destinationMarker = new this.sdk.Marker({ element }).setLngLat(toMapTilerCoordinate(coordinate)).addTo(this.map);
  }

  private removeDestination(): void {
    this.destinationMarker?.remove();
    this.destinationMarker = null;
  }

  centerOn(coordinate: LatLng, distance?: number): void {
    this.queueCamera({ center: toMapTilerCoordinate(coordinate),
      ...(distance === undefined ? {} : { zoom: zoomForCameraDistance(distance) }) });
  }

  setCameraDistance(distance: number): void {
    const zoom = zoomForCameraDistance(distance);
    if (Math.abs((this.pendingCamera?.zoom ?? this.map.getZoom()) - zoom) > 0.01) this.queueCamera({ zoom });
  }

  setRotation(degrees: number): void { this.queueCamera({ bearing: degrees }); }

  private queueCamera(options: EaseToOptions): void {
    this.pendingCamera = { ...this.pendingCamera, ...options };
    if (this.cameraQueued) return;
    this.cameraQueued = true;
    // Navigation changes center, zoom, and heading together. Independent SDK
    // camera calls cancel each other's animations, so commit them as one update.
    queueMicrotask(() => {
      this.cameraQueued = false;
      const camera = this.pendingCamera;
      this.pendingCamera = null;
      if (camera && !this.disposed) this.map.easeTo({ ...camera, duration: 350 });
    });
  }

  private fitCoordinates(coordinates: LatLng[], forRoute = false): void {
    this.pendingCamera = null;
    const bounds = new this.sdk.LngLatBounds();
    coordinates.forEach((coordinate) => bounds.extend(toMapTilerCoordinate(coordinate)));
    const height = this.map.getContainer().clientHeight || window.innerHeight;
    this.map.fitBounds(bounds, {
      padding: { top: forRoute ? 96 : 120, right: 32, left: 32,
        bottom: forRoute ? Math.min(Math.round(height * 0.55), Math.max(32, height - 160)) : 88 },
      maxZoom: coordinates.length === 1 ? 15 : 16,
      duration: 350,
    });
  }

  resize(): void { if (!this.disposed) this.map.resize(); }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.loadTimeout);
    this.rejectReady(new Error("Map was closed"));
    this.userMarker?.remove();
    this.overrideMarker?.remove();
    this.removeDestination();
    this.map.remove();
  }
}
