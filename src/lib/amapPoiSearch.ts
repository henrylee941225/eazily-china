import type { LatLng } from "@/lib/geoDatum";
import type { AutocompleteSuggestion, Place } from "@/lib/mapTypes";
import { translatePoiTexts } from "@/lib/poiTranslation";
import { supabase } from "@/integrations/supabase/client";

type AmapPoi = {
  id?: unknown;
  name?: unknown;
  address?: unknown;
  cityname?: unknown;
  adname?: unknown;
  location?: unknown;
  photos?: unknown;
};

type AmapResponse = { pois?: AmapPoi[]; tips?: AmapPoi[]; error?: string };
type SearchRequest = {
  action: "nearby" | "suggest" | "detail";
  query?: string;
  city?: string;
  id?: string;
  center?: LatLng;
  radius?: number;
};

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
  const photos = Array.isArray(poi.photos)
    ? poi.photos.flatMap((photo: unknown) => {
      if (!photo || typeof photo !== "object") return [];
      const item = photo as { url?: unknown; title?: unknown };
      const url = asText(item.url).replace(/^http:\/\/store\.is\.autonavi\.com\//i, "https://store.is.autonavi.com/");
      const title = asText(item.title);
      return /^https?:\/\//i.test(url) ? [{ url, ...(title && { title }) }] : [];
    })
    : [];
  return {
    name,
    formattedAddress: [area, address].filter(Boolean).join(" · ") || name,
    coordinate,
    poiId: asText(poi.id),
    ...(photos.length > 0 && { photos }),
  };
};

const translatePlaces = async (places: Place[], signal?: AbortSignal): Promise<Place[]> => {
  if (!places.length) return places;
  const translated = await translatePoiTexts(places.flatMap((place) => [place.name ?? "", place.formattedAddress ?? ""]), signal);
  return places.map((place, index) => {
    const name = translated[index * 2];
    const formattedAddress = translated[index * 2 + 1];
    return {
      ...place,
      name,
      formattedAddress,
      ...(name !== place.name && { originalName: place.name }),
      ...(formattedAddress !== place.formattedAddress && { originalFormattedAddress: place.formattedAddress }),
    };
  });
};

const invoke = async (body: SearchRequest, signal?: AbortSignal): Promise<AmapResponse> => {
  const { data, error } = await supabase.functions.invoke<AmapResponse>("amap-poi", { body, signal });
  if (error) {
    const response = "context" in error ? error.context : null;
    const payload = response instanceof Response
      ? await response.json().catch(() => null) as { error?: string } | null
      : null;
    throw new Error(payload?.error || error.message || "AMap search is unavailable");
  }
  if (!data || typeof data !== "object") throw new Error("Invalid AMap search response");
  if (data.error) throw new Error(data.error);
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
    const places = await translatePlaces(data.pois.map(toPlace).filter((place): place is Place => !!place), area.signal);
    return area.signal?.aborted ? [] : places;
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
      ? { action: "suggest", query: keyword, city: area.city }
      : { action: "suggest", query: keyword, center: area.center }, area.signal);
    if (area.signal?.aborted) return [];
    const suggestions = data.tips;
    if (!Array.isArray(suggestions)) throw new Error("Invalid AMap suggestions response");
    const results = suggestions.flatMap((tip) => {
      const name = asText(tip.name);
      if (!name) return [];
      const coordinate = parseAmapCoordinate(tip.location);
      const district = [asText(tip.cityname), asText(tip.adname)].filter(Boolean).join(" ");
      const address = asText(tip.address);
      return [{
        displayLines: [name, [district, address].filter(Boolean).join(" · ")].filter(Boolean),
        coordinate,
        raw: { provider: "amap", id: asText(tip.id) },
      }];
    });
    const translated = await translatePoiTexts(results.flatMap((result) => result.displayLines), area.signal);
    if (area.signal?.aborted) return [];
    let index = 0;
    return results.map((result) => {
      const displayLines = result.displayLines.map(() => translated[index++]);
      return {
        ...result,
        displayLines,
        raw: {
          ...(result.raw as { provider: string; id: string }),
          originalDisplayLines: result.displayLines,
        },
      };
    });
  } catch (error) {
    if (area.signal?.aborted) return [];
    throw error;
  }
};

export const isAmapSuggestion = (suggestion: AutocompleteSuggestion): boolean =>
  (suggestion.raw as { provider?: unknown } | undefined)?.provider === "amap";

export const resolveAmapSuggestion = async (suggestion: AutocompleteSuggestion): Promise<Place | null> => {
  const raw = suggestion.raw as { id?: unknown; originalDisplayLines?: string[] } | undefined;
  const id = asText(raw?.id);
  if (id) {
    try {
      const data = await invoke({ action: "detail", id });
      const place = data.pois?.[0] && toPlace(data.pois[0]);
      if (place) return (await translatePlaces([place]))[0];
    } catch (error) {
      console.warn("AMap place detail failed", error);
    }
  }
  if (!suggestion.coordinate) return null;
  return {
    name: suggestion.displayLines[0],
    formattedAddress: suggestion.displayLines.slice(1).join(" · ") || suggestion.displayLines[0],
    ...(raw?.originalDisplayLines?.[0] && raw.originalDisplayLines[0] !== suggestion.displayLines[0] && {
      originalName: raw.originalDisplayLines[0],
    }),
    ...(raw?.originalDisplayLines?.[1] && raw.originalDisplayLines[1] !== suggestion.displayLines[1] && {
      originalFormattedAddress: raw.originalDisplayLines[1],
    }),
    coordinate: suggestion.coordinate,
    poiId: id,
  };
};
