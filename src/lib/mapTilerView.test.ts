import { beforeEach, describe, expect, it, vi } from "vitest";
import { wgs84ToGcj02 } from "./geoDatum";
import { MapTilerView } from "./mapTilerView";

function makeRenderer() {
  const createMap = vi.fn();
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn>; getClusterExpansionZoom: ReturnType<typeof vi.fn> }>();
  const map = {
    on: vi.fn((event: string, layerOrCallback: string | ((...args: unknown[]) => void), callback?: (...args: unknown[]) => void) => {
      listeners.set(typeof layerOrCallback === "string" ? `${event}:${layerOrCallback}` : event,
        typeof layerOrCallback === "string" ? callback : layerOrCallback);
    }),
    addSource: vi.fn((id: string) => { sources.set(id, { setData: vi.fn(), getClusterExpansionZoom: vi.fn().mockResolvedValue(15) }); }),
    getSource: vi.fn((id: string) => sources.get(id)), addLayer: vi.fn(), setPaintProperty: vi.fn(), setFilter: vi.fn(),
    getContainer: () => ({ clientHeight: 700 }), fitBounds: vi.fn(), setFeatureState: vi.fn(),
    easeTo: vi.fn(), remove: vi.fn(), resize: vi.fn(), touchZoomRotate: { disableRotation: vi.fn() },
    getZoom: () => 12,
  };
  const bounds = { extend: vi.fn() };
  bounds.extend.mockReturnValue(bounds);
  const sdk = {
    Map: class { constructor(options: unknown) { createMap(options); return map; } },
    LngLatBounds: class { constructor() { return bounds; } },
    MapStyle: { STREETS: "streets-v2" },
    Language: { ENGLISH: "en" },
  } as unknown as typeof import("@maptiler/sdk");
  return { sdk, map, bounds, listeners, sources, createMap };
}

const initialGps = { latitude: 39.9042, longitude: 116.4074 };
const initialCenter = wgs84ToGcj02(initialGps);

describe("MapTiler renderer boundary", () => {
  let renderer: ReturnType<typeof makeRenderer>;
  beforeEach(() => { renderer = makeRenderer(); });

  it("draws an existing China place at its WGS-84 position and returns the original place on selection", async () => {
    const onSelect = vi.fn();
    const view = new MapTilerView(renderer.sdk, document.createElement("div"), "public-key", onSelect, initialCenter, 14);
    const options = renderer.createMap.mock.calls[0][0];
    expect(options.zoom).toBe(14);
    expect(options.language).toBe("en");
    expect(options.center[0]).toBeCloseTo(initialGps.longitude, 6);
    expect(options.center[1]).toBeCloseTo(initialGps.latitude, 6);
    const gps = { latitude: 31.2304, longitude: 121.4737 };
    const place = { name: "Saved restaurant", coordinate: wgs84ToGcj02(gps) };
    view.setPlaces([place], { glyphText: "F" });
    renderer.listeners.get("load")();
    await view.ready;
    const source = renderer.map.addSource.mock.calls.find(([id]) => id === "eazi-places");
    const data = (source as unknown as [string, { data: { features: Array<{ geometry: { coordinates: number[] } }> } }])[1].data;
    expect(data.features[0].geometry.coordinates[0]).toBeCloseTo(gps.longitude, 7);
    expect(data.features[0].geometry.coordinates[1]).toBeCloseTo(gps.latitude, 7);
    renderer.listeners.get("click:eazi-pins")({ features: [{ properties: { placeIndex: 0 } }] });
    expect(onSelect).toHaveBeenCalledWith(place);
    view.destroy();
  });

  it("expands a tapped cluster using the source's expansion zoom", async () => {
    const view = new MapTilerView(renderer.sdk, document.createElement("div"), "public-key", vi.fn(), initialCenter, 14);
    renderer.listeners.get("load")();
    await view.ready;
    renderer.listeners.get("click:eazi-clusters")({ features: [{ properties: { cluster_id: 42 }, geometry: { type: "Point", coordinates: [121.47, 31.23] } }] });
    await Promise.resolve();
    expect(renderer.sources.get("eazi-places").getClusterExpansionZoom).toHaveBeenCalledWith(42);
    expect(renderer.map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 15, center: [121.47, 31.23] }));
    view.destroy();
  });

  it("releases a renderer closed during loading and ignores its late load event", async () => {
    const view = new MapTilerView(renderer.sdk, document.createElement("div"), "public-key", vi.fn(), initialCenter, 14);
    const result = expect(view.ready).rejects.toThrow("Map was closed");
    view.destroy();
    view.destroy();
    renderer.listeners.get("load")();
    await result;
    expect(renderer.map.remove).toHaveBeenCalledTimes(1);
    expect(renderer.map.addSource).not.toHaveBeenCalled();
  });

  it("combines navigation position, zoom, and heading into one camera animation", async () => {
    const view = new MapTilerView(renderer.sdk, document.createElement("div"), "public-key", vi.fn(), initialCenter, 14);
    renderer.listeners.get("load")();
    await view.ready;
    const gps = { latitude: 31.2304, longitude: 121.4737 };
    view.centerOn(wgs84ToGcj02(gps));
    view.setCameraDistance(500);
    view.setRotation(90);
    await Promise.resolve();
    expect(renderer.map.easeTo).toHaveBeenCalledTimes(1);
    const update = renderer.map.easeTo.mock.calls[0][0];
    expect(update.center[0]).toBeCloseTo(gps.longitude, 7);
    expect(update.center[1]).toBeCloseTo(gps.latitude, 7);
    expect(update).toMatchObject({ zoom: 16, bearing: 90 });
    view.destroy();
  });
});
