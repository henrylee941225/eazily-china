import { describe, expect, it } from "vitest";
import { gcj02ToWgs84, wgs84ToGcj02 } from "./geoDatum";
import { navigationFeatures, toMapTilerCoordinate, zoomForCameraDistance } from "./mapCoordinates";

describe("map coordinate boundaries", () => {
  it.each([
    { latitude: 31.2304, longitude: 121.4737 },
    { latitude: 39.9042, longitude: 116.4074 },
    { latitude: 30.5728, longitude: 104.0668 },
  ])("round-trips GPS and existing China coordinates at $latitude,$longitude", (gps) => {
    const existing = wgs84ToGcj02(gps);
    expect(Math.abs(existing.longitude - gps.longitude)).toBeGreaterThan(0.001);
    const restored = gcj02ToWgs84(existing);
    expect(restored.latitude).toBeCloseTo(gps.latitude, 7);
    expect(restored.longitude).toBeCloseTo(gps.longitude, 7);
    const [longitude, latitude] = toMapTilerCoordinate(existing);
    expect(longitude).toBeCloseTo(gps.longitude, 7);
    expect(latitude).toBeCloseTo(gps.latitude, 7);
  });

  it("preserves coordinates outside China", () => {
    const gps = { latitude: 40.7128, longitude: -74.006 };
    expect(wgs84ToGcj02(gps)).toEqual(gps);
    expect(gcj02ToWgs84(gps)).toEqual(gps);
    expect(toMapTilerCoordinate(gps)).toEqual([-74.006, 40.7128]);
  });

  it("retains navigation step indexes when a transit step has no drawable geometry", () => {
    const gps = { latitude: 31.2304, longitude: 121.4737 };
    const data = navigationFeatures([
      { instructions: "Board the train", distance: 0, path: [] },
      { instructions: "Walk to the exit", distance: 10, path: [wgs84ToGcj02(gps), wgs84ToGcj02({ ...gps, latitude: gps.latitude + 0.001 })] },
    ]);
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties.stepIndex).toBe(1);
    expect(data.features[0].geometry.coordinates[0][0]).toBeCloseTo(gps.longitude, 7);
  });

  it("keeps navigation closer than the normal overview and clamps extreme distances", () => {
    expect(zoomForCameraDistance(500)).toBeGreaterThan(zoomForCameraDistance(2000));
    expect(zoomForCameraDistance(0)).toBe(19);
    expect(zoomForCameraDistance(1e12)).toBe(2);
  });
});
