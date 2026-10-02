import { buildAmapRequest } from "./request.ts";

const center = { latitude: 31.2304, longitude: 121.4737 };

Deno.test("nearby POI request uses the current map center and keyword", () => {
  const url = buildAmapRequest({ action: "nearby", query: "餐厅", center, radius: 12000 }, "test-key");
  if (!url) throw new Error("Expected a valid request");
  if (url.pathname !== "/v5/place/around") throw new Error("Wrong AMap endpoint");
  if (url.searchParams.get("keywords") !== "餐厅") throw new Error("Keyword was not forwarded");
  if (url.searchParams.get("location") !== "121.473700,31.230400") throw new Error("Coordinate order is wrong");
  if (url.searchParams.get("radius") !== "12000") throw new Error("Radius was not forwarded");
  if (url.searchParams.get("page_size") !== "20") throw new Error("Page size was not forwarded");
});

Deno.test("suggestions use POI 2.0 text search with a city bias", () => {
  const url = buildAmapRequest({ action: "suggest", query: "外滩", center, city: "021" }, "test-key");
  if (!url) throw new Error("Expected a valid request");
  if (url.pathname !== "/v5/place/text") throw new Error("Wrong AMap endpoint");
  if (url.searchParams.get("region") !== "021" || url.searchParams.has("location")) {
    throw new Error("POI suggestions were not scoped correctly");
  }
});

Deno.test("suggestions without a city use POI 2.0 around the map center", () => {
  const url = buildAmapRequest({ action: "suggest", query: "酒店", center }, "test-key");
  if (!url) throw new Error("Expected a valid request");
  if (url.pathname !== "/v5/place/around" || url.searchParams.get("radius") !== "20000") {
    throw new Error("POI suggestions were not searched around the center");
  }
});

Deno.test("POI details use the 2.0 ID search", () => {
  const url = buildAmapRequest({ action: "detail", id: "B123" }, "test-key");
  if (!url || url.pathname !== "/v5/place/detail" || url.searchParams.get("id") !== "B123") {
    throw new Error("Wrong AMap detail request");
  }
});

Deno.test("rejects malformed requests before making a provider call", () => {
  const invalid = [
    { action: "nearby" as const, query: "餐厅" },
    { action: "nearby" as const, query: "餐厅", center: { latitude: 100, longitude: 0 } },
    { action: "suggest" as const, query: "" },
    { action: "detail" as const, id: "../../etc/passwd" },
  ];
  if (invalid.some((request) => buildAmapRequest(request, "test-key") !== null)) {
    throw new Error("An invalid request was accepted");
  }
});
