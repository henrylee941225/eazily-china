import type { FeatureCollection, LineString } from "geojson";
import { gcj02ToWgs84, type LatLng } from "@/lib/geoDatum";
import type { RouteStep } from "@/lib/mapTypes";

export const toMapTilerCoordinate = (coordinate: LatLng): [number, number] => {
  const wgs84 = gcj02ToWgs84(coordinate);
  return [wgs84.longitude, wgs84.latitude];
};

// Match the existing meter-based camera interface to MapLibre's zoom levels.
export const zoomForCameraDistance = (distance: number): number =>
  Math.max(2, Math.min(19, 14 + Math.log2(2000 / Math.max(1, distance))));

export function navigationFeatures(steps: RouteStep[]): FeatureCollection<LineString, { stepIndex: number }> {
  return {
    type: "FeatureCollection",
    features: steps.flatMap((step, stepIndex) => step.path.length < 2 ? [] : [{
      type: "Feature" as const,
      properties: { stepIndex },
      geometry: { type: "LineString" as const, coordinates: step.path.map(toMapTilerCoordinate) },
    }]),
  };
}
