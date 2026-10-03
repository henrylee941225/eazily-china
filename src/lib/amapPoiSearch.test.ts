import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAmapCoordinate, resolveAmapSuggestion, searchAmapPlaces, searchAmapSuggestions } from "./amapPoiSearch";

const { invokeMock, translateMock } = vi.hoisted(() => ({ invokeMock: vi.fn(), translateMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: invokeMock } } }));
vi.mock("@/lib/poiTranslation", () => ({ translatePoiTexts: translateMock }));

const center = { latitude: 31.2304, longitude: 121.4737 };
const success = (data: object) => ({ data, error: null });

describe("AMap POI search", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    translateMock.mockReset();
    translateMock.mockImplementation(async (texts: string[]) => texts);
  });

  it("searches through the Edge Function and preserves coordinates and photos", async () => {
    invokeMock.mockResolvedValue(success({ pois: [
      { id: "B001", name: "餐厅", location: "121.474000,31.231000", cityname: "上海市", address: "人民路", photos: [
        { title: "Front entrance", url: "https://example.com/front.jpg" },
        { url: "http://store.is.autonavi.com/showpic/interior" },
        { title: "Missing URL" },
      ] },
      { id: "B002", name: "Invalid", location: [] },
    ] }));
    await expect(searchAmapPlaces("餐厅", { center, radius: 3000 })).resolves.toEqual([{
      name: "餐厅", formattedAddress: "上海市 · 人民路",
      coordinate: { latitude: 31.231, longitude: 121.474 }, poiId: "B001",
      photos: [
        { title: "Front entrance", url: "https://example.com/front.jpg" },
        { url: "https://store.is.autonavi.com/showpic/interior" },
      ],
    }]);
    expect(invokeMock).toHaveBeenCalledWith("amap-poi", { body: {
      action: "nearby", query: "餐厅", center, radius: 10000,
    }, signal: undefined });
  });

  it("distinguishes function failures from empty and malformed results", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error("AMap search is unavailable") });
    await expect(searchAmapPlaces("餐厅", { center })).rejects.toThrow("AMap search is unavailable");
    invokeMock.mockResolvedValueOnce(success({ pois: [] }));
    await expect(searchAmapPlaces("餐厅", { center })).resolves.toEqual([]);
    invokeMock.mockResolvedValueOnce(success({ tips: [] }));
    await expect(searchAmapPlaces("餐厅", { center })).rejects.toThrow("Invalid AMap places response");
    invokeMock.mockResolvedValueOnce(success({ error: "AMap search is not configured" }));
    await expect(searchAmapPlaces("餐厅", { center })).rejects.toThrow("AMap search is not configured");
  });

  it("translates POI text without changing identity or coordinates", async () => {
    invokeMock.mockResolvedValue(success({ pois: [
      { id: "B001", name: "餐厅", location: "121.474000,31.231000", address: "人民路" },
    ] }));
    translateMock.mockResolvedValueOnce(["Restaurant", "Renmin Road"]);
    await expect(searchAmapPlaces("餐厅", { center })).resolves.toEqual([{
      name: "Restaurant", formattedAddress: "Renmin Road",
      originalName: "餐厅", originalFormattedAddress: "人民路",
      coordinate: { latitude: 31.231, longitude: 121.474 }, poiId: "B001",
    }]);
  });

  it("resolves a city-scoped suggestion by its POI ID", async () => {
    invokeMock.mockResolvedValueOnce(success({ tips: [
      { id: "B123", name: "外滩", cityname: "上海市", adname: "黄浦区", location: "121.4905,31.2397" },
    ] }));
    const suggestions = await searchAmapSuggestions("外滩", { center, city: "021" });
    expect(invokeMock).toHaveBeenCalledWith("amap-poi", { body: {
      action: "suggest", query: "外滩", city: "021",
    }, signal: undefined });
    expect(suggestions[0].displayLines).toEqual(["外滩", "上海市 黄浦区"]);

    invokeMock.mockResolvedValueOnce(success({ pois: [
      { id: "B123", name: "外滩", location: "121.4906,31.2398", address: "中山东一路", photos: [
        { url: "https://example.com/bund.jpg" },
      ] },
    ] }));
    await expect(resolveAmapSuggestion(suggestions[0])).resolves.toEqual({
      name: "外滩", formattedAddress: "中山东一路",
      coordinate: { latitude: 31.2398, longitude: 121.4906 }, poiId: "B123",
      photos: [{ url: "https://example.com/bund.jpg" }],
    });
    expect(invokeMock).toHaveBeenLastCalledWith("amap-poi", { body: {
      action: "detail", id: "B123",
    }, signal: undefined });
  });

  it("uses the suggestion when detail lookup fails", async () => {
    invokeMock.mockResolvedValueOnce(success({ tips: [
      { id: "B123", name: "外滩", cityname: "上海市", adname: "黄浦区", location: "121.4905,31.2397" },
    ] }));
    translateMock.mockResolvedValueOnce(["The Bund", "Huangpu District, Shanghai"]);
    const suggestions = await searchAmapSuggestions("外滩", { center, city: "021" });
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error("Detail unavailable") });
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

  it("searches around the map center when no city is selected", async () => {
    invokeMock.mockResolvedValue(success({ tips: [
      { id: "B456", name: "附近酒店", location: "121.4800,31.2400", cityname: "上海市" },
    ] }));
    const suggestions = await searchAmapSuggestions("酒店", { center });
    expect(invokeMock).toHaveBeenCalledWith("amap-poi", { body: {
      action: "suggest", query: "酒店", center,
    }, signal: undefined });
    expect(suggestions[0].displayLines).toEqual(["附近酒店", "上海市"]);
  });

  it("rejects invalid coordinates and ignores an aborted result", async () => {
    expect(parseAmapCoordinate(" , ")).toBeUndefined();
    expect(parseAmapCoordinate("181,31")).toBeUndefined();
    const controller = new AbortController();
    invokeMock.mockImplementation(async () => {
      controller.abort();
      return success({ pois: [{ name: "Late", location: "121.4,31.2" }] });
    });
    await expect(searchAmapPlaces("餐厅", { center, signal: controller.signal })).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith("amap-poi", { body: expect.any(Object), signal: controller.signal });
  });
});
