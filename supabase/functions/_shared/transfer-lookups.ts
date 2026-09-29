// Server-side mirror of the airport / station reference data in
// src/lib/transfers.ts. Edge functions cannot import from `src/`, so the
// Chinese names and coordinates needed for ops emails live here too.
// Update both files together when adding a new airport or station.

export type Coord = { lat: number; lng: number };

export const AIRPORT_LOOKUP: Record<
  string,
  { name: string; cn: string; coord: Coord }
> = {
  PVG: {
    name: "Pudong Int'l Airport (PVG)",
    cn: "浦东国际机场",
    coord: { lat: 31.1443, lng: 121.8083 },
  },
  SHA: {
    name: "Hongqiao Int'l Airport (SHA)",
    cn: "虹桥机场",
    coord: { lat: 31.1979, lng: 121.3363 },
  },
};

export const STATION_LOOKUP: Record<
  string,
  { name: string; cn: string; coord: Coord }
> = {
  hongqiao: {
    name: "Hongqiao Railway Station",
    cn: "虹桥站",
    coord: { lat: 31.1943, lng: 121.3200 },
  },
  shanghai: {
    name: "Shanghai Railway Station",
    cn: "上海站",
    coord: { lat: 31.2497, lng: 121.4552 },
  },
  shanghai_south: {
    name: "Shanghai South Railway Station",
    cn: "上海南站",
    coord: { lat: 31.1547, lng: 121.4292 },
  },
};

export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}