import { buildAmapRequest } from "./request.ts";

const center = { latitude: 31.2304, longitude: 121.4737 };

Deno.test("nearby POI request uses the current map center and keyword", () => {
  const url = buildAmapRequest({ action: "nearby", query: "餐厅", center, radius: 12000 }, "test-key");
  if (!url) throw new Error("Expected a valid request");
  if (url.pathname !== "/v3/place/around") throw new Error("Wrong AMap endpoint");
  if (url.searchParams.get("keywords") !== "餐厅") throw new Error("Keyword was not forwarded");
  if (url.searchParams.get("location") !== "121.473700,31.230400") throw new Error("Coordinate order is wrong");
  if (url.searchParams.get("radius") !== "12000") throw new Error("Radius was not forwarded");
});

Deno.test("input tips are restricted to POIs and can use a city bias", () => {
  const url = buildAmapRequest({ action: "suggest", query: "外滩", center, city: "021" }, "test-key");
  if (!url) throw new Error("Expected a valid request");
  if (url.pathname !== "/v3/assistant/inputtips") throw new Error("Wrong AMap endpoint");
  if (url.searchParams.get("datatype") !== "poi" || url.searchParams.get("city") !== "021") {
    throw new Error("POI tips were not scoped correctly");
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
