import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Position, WatchPositionCallback } from "@capacitor/geolocation";

const sdk = vi.hoisted(() => ({
  native: true,
  checkPermissions: vi.fn(), requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn(),
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: sdk }));
vi.mock("@/integrations/capacitor", () => ({ isCapacitorApp: () => sdk.native }));

import { getCurrentLocation, watchLocation } from "./geolocation";

const position = { timestamp: 1, coords: { latitude: 31.23, longitude: 121.47 } } as Position;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

describe("Capacitor location lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sdk.native = true;
    sdk.checkPermissions.mockResolvedValue({ location: "granted", coarseLocation: "granted" });
    sdk.getCurrentPosition.mockResolvedValue(position);
    sdk.clearWatch.mockResolvedValue(undefined);
  });

  it("uses the native provider and enables Android's fallback for devices without Play Services", async () => {
    expect(await getCurrentLocation()).toBe(position);
    expect(sdk.getCurrentPosition).toHaveBeenCalledWith(expect.objectContaining({ enableLocationFallback: true }));
    expect(sdk.requestPermissions).not.toHaveBeenCalled();
  });

  it("keeps web permission handling in the plugin's browser implementation", async () => {
    sdk.native = false;
    await getCurrentLocation();
    expect(sdk.checkPermissions).not.toHaveBeenCalled();
    expect(sdk.requestPermissions).not.toHaveBeenCalled();
  });

  it("rejects denied permissions before requesting a position", async () => {
    sdk.checkPermissions.mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    sdk.requestPermissions.mockResolvedValue({ location: "denied", coarseLocation: "denied" });
    await expect(getCurrentLocation()).rejects.toMatchObject({ code: "OS-PLUG-GLOC-0003" });
    expect(sdk.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("accepts Android approximate location without asking for permission again", async () => {
    sdk.checkPermissions.mockResolvedValue({ location: "denied", coarseLocation: "granted" });
    await getCurrentLocation();
    expect(sdk.requestPermissions).not.toHaveBeenCalled();
  });

  it("shares one native permission request between concurrent location callers", async () => {
    let resolvePermission: (permission: { location: string; coarseLocation: string }) => void;
    sdk.checkPermissions.mockResolvedValue({ location: "prompt", coarseLocation: "prompt" });
    sdk.requestPermissions.mockImplementation(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const first = getCurrentLocation();
    const second = getCurrentLocation();
    await flush();
    expect(sdk.checkPermissions).toHaveBeenCalledTimes(1);
    expect(sdk.requestPermissions).toHaveBeenCalledTimes(1);
    resolvePermission({ location: "granted", coarseLocation: "granted" });
    await expect(Promise.all([first, second])).resolves.toEqual([position, position]);
    expect(sdk.getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("clears a watch that finishes registering after navigation has stopped", async () => {
    let register: (id: string) => void;
    let callback: WatchPositionCallback;
    sdk.watchPosition.mockImplementation((_options, listener: WatchPositionCallback) => {
      callback = listener;
      return new Promise<string>((resolve) => { register = resolve; });
    });
    const onPosition = vi.fn();
    const stop = watchLocation(onPosition, vi.fn(), { timeout: 45000 });
    await flush();
    expect(sdk.watchPosition).toHaveBeenCalledWith(expect.objectContaining({ timeout: 45000 }), expect.any(Function));
    stop();
    register("late-watch");
    await flush();
    callback(position);
    expect(sdk.clearWatch).toHaveBeenCalledExactlyOnceWith({ id: "late-watch" });
    expect(onPosition).not.toHaveBeenCalled();
  });

  it("does not register a watch after being stopped during a permission prompt", async () => {
    let resolvePermission: (permission: { location: string; coarseLocation: string }) => void;
    sdk.checkPermissions.mockImplementation(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const stop = watchLocation(vi.fn(), vi.fn());
    stop();
    resolvePermission({ location: "granted", coarseLocation: "granted" });
    await flush();
    expect(sdk.watchPosition).not.toHaveBeenCalled();
  });

  it("reports registration failures without an unhandled rejection", async () => {
    sdk.watchPosition.mockRejectedValue(new Error("Location services disabled"));
    const onError = vi.fn();
    const stop = watchLocation(vi.fn(), onError);
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Location services disabled" }));
    stop();
  });
});
