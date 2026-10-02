import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

describe("POI translation", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  it("batches Chinese text, caches duplicates, and leaves Latin text unchanged", async () => {
    invokeMock.mockResolvedValue({ data: { translated: "The Bund\nShanghai" }, error: null });
    const { translatePoiTexts } = await import("./poiTranslation");

    await expect(translatePoiTexts(["外滩", "Shanghai", "上海", "外滩"])).resolves.toEqual([
      "The Bund", "Shanghai", "Shanghai", "The Bund",
    ]);
    await expect(translatePoiTexts(["外滩"])).resolves.toEqual(["The Bund"]);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("translate", expect.objectContaining({
      body: { text: "外滩\n上海", from: "zh", to: "en" },
    }));
  });

  it("retries a mismatched batch in smaller groups", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    invokeMock
      .mockResolvedValueOnce({ data: { translated: "Combined result" }, error: null })
      .mockResolvedValueOnce({ data: { translated: "The Bund" }, error: null })
      .mockResolvedValueOnce({ data: { translated: "Shanghai" }, error: null });
    const { translatePoiTexts } = await import("./poiTranslation");

    try {
      const translation = translatePoiTexts(["外滩", "上海"]);
      await vi.runAllTimersAsync();
      await expect(translation).resolves.toEqual(["The Bund", "Shanghai"]);
      expect(invokeMock).toHaveBeenCalledTimes(3);
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("preserves original text when a single translation cannot be matched", async () => {
    invokeMock.mockResolvedValue({ data: { translated: "One\nTwo" }, error: null });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { translatePoiTexts } = await import("./poiTranslation");

    try {
      await expect(translatePoiTexts(["外滩"])).resolves.toEqual(["外滩"]);
    } finally {
      warn.mockRestore();
    }
  });

  it("preserves original text if translation fails", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("Unavailable") });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { translatePoiTexts } = await import("./poiTranslation");
      await expect(translatePoiTexts(["人民路"])).resolves.toEqual(["人民路"]);
    } finally {
      warn.mockRestore();
    }
  });

  it("skips translation for an aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const { translatePoiTexts } = await import("./poiTranslation");

    await expect(translatePoiTexts(["餐厅"], controller.signal)).resolves.toEqual(["餐厅"]);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
