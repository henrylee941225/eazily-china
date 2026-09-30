const endpoints = {
  nearby: "https://restapi.amap.com/v3/place/around",
  suggest: "https://restapi.amap.com/v3/assistant/inputtips",
  detail: "https://restapi.amap.com/v3/place/detail",
} as const;

export type SearchRequest = {
  action?: keyof typeof endpoints;
  query?: string;
  city?: string;
  id?: string;
  center?: { latitude?: number; longitude?: number };
  radius?: number;
};

const validCenter = (center: SearchRequest["center"]): center is { latitude: number; longitude: number } =>
  !!center && typeof center.latitude === "number" && typeof center.longitude === "number" &&
  Number.isFinite(center.latitude) && Number.isFinite(center.longitude) &&
  Math.abs(center.latitude) <= 90 && Math.abs(center.longitude) <= 180;

export const buildAmapRequest = (body: SearchRequest, key: string): URL | null => {
  const action = body.action;
  if (!action || !Object.prototype.hasOwnProperty.call(endpoints, action)) return null;
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (query.length > 80 || (city !== "" && !/^\d{2,6}$/.test(city))) return null;
  if (action === "suggest" && !query) return null;
  if (action === "nearby" && (!validCenter(body.center) || !query)) return null;
  if (action === "detail" && !/^[A-Za-z0-9]{1,32}$/.test(id)) return null;

  const url = new URL(endpoints[action]);
  url.searchParams.set("key", key);
  url.searchParams.set("output", "json");
  if (action === "detail") {
    url.searchParams.set("id", id);
    return url;
  }
  if (query) url.searchParams.set("keywords", query);
  if (city) url.searchParams.set("city", city);
  if (validCenter(body.center)) {
    url.searchParams.set("location", `${body.center.longitude.toFixed(6)},${body.center.latitude.toFixed(6)}`);
  }
  if (action === "nearby") {
    const radius = typeof body.radius === "number" && Number.isFinite(body.radius)
      ? Math.min(50000, Math.max(100, Math.round(body.radius))) : 5000;
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("offset", "20");
  } else {
    url.searchParams.set("datatype", "poi");
  }
  return url;
};
