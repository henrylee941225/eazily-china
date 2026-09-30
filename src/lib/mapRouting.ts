import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/lib/geoDatum";
import type { RouteMode, RouteResult } from "@/lib/mapTypes";

export type MapRoute = RouteResult & { geometry: LatLng[] };

type AmapResponse = {
  distance_m?: number;
  duration_s?: number;
  points?: Array<[number, number]>;
  steps?: Array<{ instruction: string; distance_m: number; points?: Array<[number, number]> }>;
  error?: string;
};

async function routeViaAmap(origin: LatLng, destination: LatLng, mode: RouteMode, city: string): Promise<MapRoute | null> {
  const body = {
    origin: `${origin.longitude.toFixed(6)},${origin.latitude.toFixed(6)}`,
    destination: `${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}`,
    mode: mode === "drive" ? "driving" : mode === "walk" ? "walking" : "transit",
    city,
  };
  try {
    const { data, error } = await supabase.functions.invoke("amap-route", { body });
    const payload = data as AmapResponse | null;
    if (error || !payload || payload.error || (payload.points?.length ?? 0) < 2) return null;
    return {
      etaSec: Number(payload.duration_s ?? 0),
      distance: Number(payload.distance_m ?? 0),
      geometry: payload.points.map(([longitude, latitude]) => ({ latitude, longitude })),
      steps: (payload.steps ?? []).map((step) => ({
        instructions: step.instruction,
        distance: Number(step.distance_m ?? 0),
        path: (step.points ?? []).map(([longitude, latitude]) => ({ latitude, longitude })),
      })),
    };
  } catch (error) {
    console.warn("Amap routing failed", error);
    return null;
  }
}

export async function calculateMapRoute(
  origin: LatLng,
  destination: LatLng,
  mode: RouteMode,
  city = "021",
): Promise<MapRoute | null> {
  return routeViaAmap(origin, destination, mode, city);
}
