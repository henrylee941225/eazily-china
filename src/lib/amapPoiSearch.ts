import type { LatLng } from "@/lib/geoDatum";
import type { AutocompleteSuggestion, Place } from "@/lib/mapTypes";

type AmapPoi = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  cityname?: unknown;
  adname?: unknown;
  district?: unknown;
  location?: unknown;
};

type AmapResponse = { status?: string; info?: string; pois?: AmapPoi[]; tips?: AmapPoi[] };
type SearchRequest = {
  action: "nearby" | "suggest" | "detail";
  query?: string;
  city?: string;
  id?: string;
  center?: LatLng;
  radius?: number;
};

const endpoints = {
  nearby: "https://restapi.amap.com/v3/place/around",
  suggest: "https://restapi.amap.com/v3/assistant/inputtips",
  detail: "https://restapi.amap.com/v3/place/detail",
} as const;

export type AmapSearchArea = {
  center: LatLng;
  city?: string;
  signal?: AbortSignal;
  radius?: number;
};

const asText = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export const parseAmapCoordinate = (value: unknown): LatLng | undefined => {
  if (typeof value !== "string") return undefined;
  const parts = value.split(",");
  if (parts.length !== 2) return undefined;
  if (!parts[0].trim() || !parts[1].trim()) return undefined;
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return undefined;
  return { latitude, longitude };
};

const toPlace = (poi: AmapPoi): Place | null => {
  const coordinate = parseAmapCoordinate(poi.location);
  const name = asText(poi.name);
  if (!coordinate || !name) return null;
  const address = asText(poi.address);
  const area = [asText(poi.cityname), asText(poi.adname)].filter(Boolean).join(" ");
  return {
    name,
    formattedAddress: [area, address].filter(Boolean).join(" · ") || name,
    coordinate,
    poiId: asText(poi.id),
  };
};

const buildRequestUrl = (body: SearchRequest, key: string): URL => {
  const url = new URL(endpoints[body.action]);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "json");
  if (body.action === "detail") {
    url.searchParams.set("id", body.id ?? "");
    return url;
  }
  url.searchParams.set("keywords", body.query?.trim() ?? "");
  if (body.city) url.searchParams.set("city", body.city);
  if (body.center) {
    url.searchParams.set("location", `${body.center.longitude.toFixed(6)},${body.center.latitude.toFixed(6)}`);
  }
  if (body.action === "nearby") {
    url.searchParams.set("radius", String(Math.min(50000, Math.max(100, Math.round(body.radius ?? 5000)))));
    url.searchParams.set("offset", "20");
  } else {
    url.searchParams.set("datatype", "poi");
  }
  return url;
};

const invoke = async (body: SearchRequest, signal?: AbortSignal): Promise<AmapResponse> => {
  const key = import.meta.env.VITE_AMAP_WEB_SERVICE_KEY?.trim();
  if (!key) throw new Error("VITE_AMAP_WEB_SERVICE_KEY is not configured");
  const response = await fetch(buildRequestUrl(body, key), { signal });
  if (!response.ok) throw new Error("AMap search is unavailable");
  const data: AmapResponse = await response.json();
  if (!data || data.status !== "1") throw new Error(data?.info || "AMap search is unavailable");
  return data;
};

export const searchAmapPlaces = async (
  query: string,
  area: AmapSearchArea,
): Promise<Place[]> => {
  if (!query.trim() || area.signal?.aborted) return [];
  try {
    const body: SearchRequest = {
      action: "nearby",
      query: query.trim(),
      center: area.center,
      radius: Math.max(area.radius ?? 0, 10000),
    };
    const data = await invoke(body, area.signal);
    if (area.signal?.aborted) return [];
    if (!Array.isArray(data.pois)) throw new Error("Invalid AMap places response");
    return data.pois.map(toPlace).filter((place): place is Place => !!place);
  } catch (error) {
    if (area.signal?.aborted) return [];
    throw error;
  }
};

export const searchAmapSuggestions = async (
  query: string,
  area: AmapSearchArea,
): Promise<AutocompleteSuggestion[]> => {
  const keyword = query.trim();
  if (!keyword || area.signal?.aborted) return [];
  try {
    const data = await invoke(area.city
      ? { action: "suggest", query: keyword, city: area.city, center: area.center }
      : { action: "nearby", query: keyword, center: area.center, radius: 20000 }, area.signal);
    if (area.signal?.aborted) return [];
    const suggestions = area.city ? data.tips : data.pois;
    if (!Array.isArray(suggestions)) throw new Error("Invalid AMap suggestions response");
    return suggestions.flatMap((tip) => {
      const name = asText(tip.name);
      if (!name) return [];
      const coordinate = parseAmapCoordinate(tip.location);
      const district = asText(tip.district) || [asText(tip.cityname), asText(tip.adname)].filter(Boolean).join(" ");
      const address = asText(tip.address);
      return [{
        displayLines: [name, [district, address].filter(Boolean).join(" · ")].filter(Boolean),
        coordinate,
        raw: { provider: "amap", id: asText(tip.id) },
      }];
    });
  } catch (error) {
    if (area.signal?.aborted) return [];
    throw error;
  }
};

export const isAmapSuggestion = (suggestion: AutocompleteSuggestion): boolean =>
  (suggestion.raw as { provider?: unknown } | undefined)?.provider === "amap";

export const resolveAmapSuggestion = async (suggestion: AutocompleteSuggestion): Promise<Place | null> => {
  const id = asText((suggestion.raw as { id?: unknown } | undefined)?.id);
  if (id) {
    try {
      const data = await invoke({ action: "detail", id });
      const place = data.pois?.[0] && toPlace(data.pois[0]);
      if (place) return place;
    } catch (error) {
      console.warn("AMap place detail failed", error);
    }
  }
  if (!suggestion.coordinate) return null;
  return {
    name: suggestion.displayLines[0],
    formattedAddress: suggestion.displayLines.slice(1).join(" · ") || suggestion.displayLines[0],
    coordinate: suggestion.coordinate,
    poiId: id,
  };
};
