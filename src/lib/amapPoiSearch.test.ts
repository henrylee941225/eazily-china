import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseAmapCoordinate, resolveAmapSuggestion, searchAmapPlaces, searchAmapSuggestions } from "./amapPoiSearch";

const { translatePoiTextsMock } = vi.hoisted(() => ({ translatePoiTextsMock: vi.fn() }));
vi.mock("@/lib/poiTranslation", () => ({ translatePoiTexts: translatePoiTextsMock }));

const center = { latitude: 31.2304, longitude: 121.4737 };
const response = (data: object, ok = true) => ({ ok, json: async () => data } as Response);
const fetchMock = vi.fn();

describe("AMap POI search", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_AMAP_WEB_SERVICE_KEY", "test-web-service-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    translatePoiTextsMock.mockReset();
    translatePoiTextsMock.mockImplementation(async (texts: string[]) => texts);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searches AMap directly around the map center and preserves GCJ-02 coordinates", async () => {
    fetchMock.mockResolvedValue(response({ status: "1", pois: [
      { id: "B001", name: "餐厅", location: "121.474000,31.231000", cityname: "上海市", address: "人民路", photos: [
        { title: "Front entrance", url: "https://example.com/front.jpg" },
        { url: "http://store.is.autonavi.com/showpic/interior" },
        { title: "Missing URL" },
      ] },
      { id: "B002", name: "Invalid", location: [] },
    ] }));

    const places = await searchAmapPlaces("餐厅", { center, radius: 3000 });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe("https://restapi.amap.com/v5/place/around");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: "test-web-service-key", keywords: "餐厅", location: "121.473700,31.230400", radius: "10000", page_size: "20", show_fields: "photos",
    });
    expect(url.searchParams.has("offset")).toBe(false);
    expect(places).toEqual([{
      name: "餐厅", formattedAddress: "上海市 · 人民路",
      coordinate: { latitude: 31.231, longitude: 121.474 }, poiId: "B001",
      photos: [
        { title: "Front entrance", url: "https://example.com/front.jpg" },
        { url: "https://store.is.autonavi.com/showpic/interior" },
      ],
    }]);
  });

  it("distinguishes provider failures from empty results and missing configuration", async () => {
    fetchMock.mockResolvedValueOnce(response({ status: "0", info: "INVALID_USER_KEY" }));
    await expect(searchAmapPlaces("餐厅", { center })).rejects.toThrow("INVALID_USER_KEY");
    fetchMock.mockResolvedValueOnce(response({ status: "1", pois: [] }));
    await expect(searchAmapPlaces("餐厅", { center })).resolves.toEqual([]);
    vi.stubEnv("VITE_AMAP_WEB_SERVICE_KEY", "");
    await expect(searchAmapPlaces("餐厅", { center })).rejects.toThrow("VITE_AMAP_WEB_SERVICE_KEY is not configured");
  });

  it("shows translated POI text without changing its ID or coordinates", async () => {
    fetchMock.mockResolvedValue(response({ status: "1", pois: [
      { id: "B001", name: "餐厅", location: "121.474000,31.231000", address: "人民路" },
    ] }));
    translatePoiTextsMock.mockResolvedValueOnce(["Restaurant", "Renmin Road"]);

    await expect(searchAmapPlaces("餐厅", { center })).resolves.toEqual([{
      name: "Restaurant", formattedAddress: "Renmin Road",
      originalName: "餐厅", originalFormattedAddress: "人民路",
      coordinate: { latitude: 31.231, longitude: 121.474 }, poiId: "B001",
    }]);
    expect(translatePoiTextsMock).toHaveBeenCalledWith(["餐厅", "人民路"], undefined);
  });

  it("resolves a text-search result using its POI ID", async () => {
    fetchMock.mockResolvedValueOnce(response({ status: "1", pois: [
      { id: "B123", name: "外滩", cityname: "上海市", adname: "黄浦区", location: "121.4905,31.2397" },
    ] }));
    const suggestions = await searchAmapSuggestions("外滩", { center, city: "021" });
    expect(suggestions[0].displayLines).toEqual(["外滩", "上海市 黄浦区"]);
    const textUrl = fetchMock.mock.calls[0][0] as URL;
    expect(textUrl.pathname).toBe("/v5/place/text");
    expect(Object.fromEntries(textUrl.searchParams)).toMatchObject({
      keywords: "外滩", region: "021", page_size: "20", show_fields: "photos",
    });
    expect(textUrl.searchParams.has("location")).toBe(false);

    fetchMock.mockResolvedValueOnce(response({ status: "1", pois: [
      { id: "B123", name: "外滩", location: "121.4906,31.2398", address: "中山东一路", photos: [
        { url: "https://example.com/bund.jpg" },
      ] },
    ] }));
    await expect(resolveAmapSuggestion(suggestions[0])).resolves.toEqual({
      name: "外滩", formattedAddress: "中山东一路",
      coordinate: { latitude: 31.2398, longitude: 121.4906 }, poiId: "B123",
      photos: [{ url: "https://example.com/bund.jpg" }],
    });
    const detailUrl = fetchMock.mock.calls[1][0] as URL;
    expect(detailUrl.pathname).toBe("/v5/place/detail");
    expect(detailUrl.searchParams.get("id")).toBe("B123");
    expect(detailUrl.searchParams.get("show_fields")).toBe("photos");
  });

  it("translates suggestions and keeps their original POI identity for the detail fallback", async () => {
    fetchMock.mockResolvedValueOnce(response({ status: "1", pois: [
      { id: "B123", name: "外滩", cityname: "上海市", adname: "黄浦区", location: "121.4905,31.2397" },
    ] }));
    translatePoiTextsMock.mockResolvedValueOnce(["The Bund", "Huangpu District, Shanghai"]);
    const suggestions = await searchAmapSuggestions("外滩", { center, city: "021" });
    expect(suggestions[0].displayLines).toEqual(["The Bund", "Huangpu District, Shanghai"]);

    fetchMock.mockRejectedValueOnce(new Error("Detail unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(resolveAmapSuggestion(suggestions[0])).resolves.toEqual({
        name: "The Bund", formattedAddress: "Huangpu District, Shanghai",
        originalName: "外滩", originalFormattedAddress: "上海市 黄浦区",
        coordinate: { latitude: 31.2397, longitude: 121.4905 }, poiId: "B123",
      });
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps suggestions near the map center when the selected city differs", async () => {
    fetchMock.mockResolvedValue(response({ status: "1", pois: [
      { id: "B456", name: "附近酒店", location: "121.4800,31.2400", cityname: "上海市" },
    ] }));
    const suggestions = await searchAmapSuggestions("酒店", { center });
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/v5/place/around");
    expect(url.searchParams.get("radius")).toBe("20000");
    expect(suggestions[0].displayLines).toEqual(["附近酒店", "上海市"]);
  });

  it("rejects invalid coordinates and ignores an aborted result", async () => {
    expect(parseAmapCoordinate(" , ")).toBeUndefined();
    expect(parseAmapCoordinate("181,31")).toBeUndefined();
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort();
      return response({ status: "1", pois: [{ name: "Late", location: "121.4,31.2" }] });
    });
    await expect(searchAmapPlaces("餐厅", { center, signal: controller.signal })).resolves.toEqual([]);
  });
});
