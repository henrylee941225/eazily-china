import type { Place } from "@/lib/mapTypes";

const SHARE_BASE_URL = "https://app.eazilychina.com";

const hasValidCoordinate = (place: Place): place is Place & { coordinate: NonNullable<Place["coordinate"]> } => {
  const coordinate = place.coordinate;
  return !!coordinate &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    Math.abs(coordinate.latitude) <= 90 &&
    Math.abs(coordinate.longitude) <= 180;
};

export const buildPlaceShareUrl = (place: Place): string => {
  const params = new URLSearchParams();
  const name = place.name?.trim() || place.formattedAddress?.trim() || "Shared place";

  if (hasValidCoordinate(place)) {
    params.set("lat", String(place.coordinate.latitude));
    params.set("lng", String(place.coordinate.longitude));
    params.set("name", name);
    if (place.formattedAddress?.trim()) params.set("address", place.formattedAddress.trim());
  } else {
    params.set("q", name);
  }

  return `${SHARE_BASE_URL}/map?${params.toString()}`;
};

export const parseSharedPlace = (params: URLSearchParams): Place | null => {
  const lat = params.get("lat");
  const lng = params.get("lng");
  const name = params.get("name")?.trim();
  if (!lat?.trim() || !lng?.trim() || !name) return null;

  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    name,
    formattedAddress: params.get("address")?.trim() || undefined,
    coordinate: { latitude, longitude },
  };
};
