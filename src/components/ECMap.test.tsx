import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ECMapHandle } from "@/lib/mapTypes";
import { wgs84ToGcj02 } from "@/lib/geoDatum";

const mocks = vi.hoisted(() => ({
  createView: vi.fn(), getCurrentLocation: vi.fn(), calculateMapRoute: vi.fn(),
  searchAmapPlaces: vi.fn(), searchAmapSuggestions: vi.fn(), resolveAmapSuggestion: vi.fn(),
  toast: vi.fn(),
  watchLocation: vi.fn(), stopLocationWatch: vi.fn(),
}));
vi.mock("@maptiler/sdk", () => ({}));
vi.mock("@/lib/mapTilerView", () => ({ MapTilerView: class { constructor(...args: unknown[]) { return mocks.createView(...args); } } }));
vi.mock("@/integrations/capacitor", () => ({ isCapacitorApp: () => true }));
vi.mock("@/integrations/capacitor/geolocation", () => ({
  getCurrentLocation: mocks.getCurrentLocation,
  isLocationPermissionDenied: (error: { code?: unknown }) => error?.code === 1 || error?.code === "OS-PLUG-GLOC-0003",
  watchLocation: mocks.watchLocation,
}));
vi.mock("@/lib/mapRouting", () => ({ calculateMapRoute: mocks.calculateMapRoute }));
vi.mock("@/lib/amapPoiSearch", () => ({
  searchAmapPlaces: mocks.searchAmapPlaces,
  searchAmapSuggestions: mocks.searchAmapSuggestions,
  resolveAmapSuggestion: mocks.resolveAmapSuggestion,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import ECMap from "./ECMap";

const gps = { latitude: 31.2304, longitude: 121.4737 };
const coordinate = wgs84ToGcj02(gps);
const place = { name: "Test destination", coordinate };

const makeView = () => ({
  ready: Promise.resolve(), destroy: vi.fn(), resize: vi.fn(), getRegion: vi.fn(() => ({
    latitude: coordinate.latitude, longitude: coordinate.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1,
  })),
  setUserLocation: vi.fn(), centerOn: vi.fn(), setPlaces: vi.fn(), setRoute: vi.fn(),
  clearRoute: vi.fn(), setShowsUserLocation: vi.fn(),
});
let view: ReturnType<typeof makeView>;

describe("MapTiler map integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("VITE_MAPTILER_API_KEY", "test-public-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    view = makeView();
    mocks.createView.mockReturnValue(view);
    mocks.getCurrentLocation.mockResolvedValue({ coords: gps });
    mocks.watchLocation.mockReturnValue(mocks.stopLocationWatch);
    mocks.searchAmapPlaces.mockResolvedValue([place]);
    mocks.searchAmapSuggestions.mockResolvedValue([]);
  });
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("shows an unavailable state without requesting native location when the key is missing", () => {
    vi.stubEnv("VITE_MAPTILER_API_KEY", "");
    render(<ECMap />);
    expect(screen.getByRole("status")).toHaveTextContent("Map is currently unavailable.");
    expect(mocks.createView).not.toHaveBeenCalled();
    expect(mocks.getCurrentLocation).not.toHaveBeenCalled();
  });

  it("keeps GPS, search, and route coordinates consistent with existing app consumers", async () => {
    const ref = createRef<ECMapHandle>();
    const onLocation = vi.fn();
    render(<ECMap ref={ref} onUserLocation={onLocation} cityCode="010" />);
    await waitFor(() => expect(onLocation).toHaveBeenCalledWith(coordinate));
    expect(view.setUserLocation).toHaveBeenCalledWith(coordinate);
    await act(async () => { expect(await ref.current.search("restaurant")).toBe(1); });
    expect(view.setPlaces).toHaveBeenCalledWith([place], undefined);
    expect(mocks.searchAmapPlaces).toHaveBeenCalledWith("restaurant", expect.objectContaining({ center: coordinate }));
    const route = { etaSec: 600, distance: 800, steps: [], geometry: [coordinate, coordinate] };
    mocks.calculateMapRoute.mockResolvedValue(route);
    await act(async () => { await ref.current.showRoute(place, "walk"); });
    expect(mocks.calculateMapRoute).toHaveBeenCalledWith(coordinate, coordinate, "walk", "010");
    expect(view.setRoute).toHaveBeenCalledWith(route.geometry, coordinate, coordinate);
  });

  it("starts the map at the user's location instead of the fallback city", async () => {
    const current = { latitude: 39.9042, longitude: 116.4074 };
    mocks.getCurrentLocation.mockResolvedValue({ coords: current });
    render(<ECMap fallbackCenter={coordinate} />);
    await waitFor(() => expect(mocks.createView).toHaveBeenCalled());
    expect(mocks.createView.mock.calls[0][4]).toEqual(wgs84ToGcj02(current));
    expect(mocks.createView.mock.calls[0][5]).toBe(14);
    expect(view.centerOn).not.toHaveBeenCalled();
  });

  it("uses the selected city when initial location is unavailable", async () => {
    const fallbackCenter = { latitude: 39.9042, longitude: 116.4074 };
    mocks.getCurrentLocation.mockRejectedValue({ code: 1 });
    render(<ECMap fallbackCenter={fallbackCenter} />);
    await waitFor(() => expect(mocks.createView).toHaveBeenCalled());
    expect(mocks.createView.mock.calls[0][4]).toEqual(fallbackCenter);
    expect(mocks.createView.mock.calls[0][5]).toBe(12);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(mocks.watchLocation).toHaveBeenCalledTimes(1);
  });

  it("recenters when a location update arrives after initial positioning timed out", async () => {
    mocks.getCurrentLocation.mockRejectedValueOnce({ code: "OS-PLUG-GLOC-0010" });
    const fallbackCenter = { latitude: 39.9042, longitude: 116.4074 };
    render(<ECMap fallbackCenter={fallbackCenter} />);
    await waitFor(() => expect(mocks.watchLocation).toHaveBeenCalledTimes(1));
    expect(view.centerOn).not.toHaveBeenCalled();
    act(() => mocks.watchLocation.mock.calls[0][0]({ coords: gps }));
    expect(view.centerOn).toHaveBeenCalledWith(coordinate, 8000);
    expect(view.setUserLocation).toHaveBeenCalledWith(coordinate);
  });

  it("uses a recent watched location when the recenter button is pressed", async () => {
    const ref = createRef<ECMapHandle>();
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(mocks.watchLocation).toHaveBeenCalledTimes(1));
    await act(async () => ref.current.recenter());
    await waitFor(() => expect(view.centerOn).toHaveBeenCalledWith(coordinate, 8000));
    expect(mocks.getCurrentLocation).toHaveBeenCalledTimes(1);
  });

  it("shows a timeout explanation when recentering cannot get a fix", async () => {
    const ref = createRef<ECMapHandle>();
    mocks.getCurrentLocation.mockRejectedValue({ code: "OS-PLUG-GLOC-0010" });
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(mocks.watchLocation).toHaveBeenCalledTimes(1));
    await act(async () => ref.current.recenter());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining("Location timed out")));
    expect(mocks.getCurrentLocation.mock.calls[1][0]).toEqual(expect.objectContaining({ timeout: 45000, enableHighAccuracy: false }));
  });

  it("shares one pending location request across repeated recenter presses", async () => {
    const ref = createRef<ECMapHandle>();
    mocks.getCurrentLocation.mockRejectedValueOnce({ code: "OS-PLUG-GLOC-0010" });
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(mocks.watchLocation).toHaveBeenCalledTimes(1));
    let finishLocation: (value: unknown) => void;
    mocks.getCurrentLocation.mockImplementation(() => new Promise((resolve) => { finishLocation = resolve; }));
    act(() => { ref.current.recenter(); ref.current.recenter(); });
    await waitFor(() => expect(mocks.getCurrentLocation).toHaveBeenCalledTimes(2));
    await act(async () => finishLocation({ coords: gps }));
    expect(view.centerOn).toHaveBeenCalledExactlyOnceWith(coordinate, 8000);
  });

  it("does not let an old search replace a newer selected place", async () => {
    const ref = createRef<ECMapHandle>();
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(view.setUserLocation).toHaveBeenCalled());
    let finishSearch: (places: typeof place[]) => void;
    mocks.searchAmapPlaces.mockImplementation(() => new Promise((resolve) => { finishSearch = resolve; }));
    const pendingSearch = ref.current.search("old query");
    await waitFor(() => expect(mocks.searchAmapPlaces).toHaveBeenCalled());
    act(() => ref.current.showSinglePlace(place));
    await act(async () => { finishSearch([{ ...place, name: "Stale result" }]); await pendingSearch; });
    expect(view.setPlaces).toHaveBeenCalledExactlyOnceWith([place], { glyphText: undefined, color: undefined });
  });

  it("uses AMap POI search without an Apple fallback outside mainland China", async () => {
    const ref = createRef<ECMapHandle>();
    view.getRegion.mockReturnValue({ latitude: 35.6762, longitude: 139.6503, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    mocks.searchAmapPlaces.mockResolvedValue([]);
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(mocks.createView).toHaveBeenCalled());
    await act(async () => { expect(await ref.current.search("hotel")).toBe(0); });
    expect(mocks.searchAmapPlaces).toHaveBeenCalledWith("hotel", expect.objectContaining({
      center: { latitude: 35.6762, longitude: 139.6503 },
    }));
  });

  it("does not draw a route that finishes after the user cleared it", async () => {
    const ref = createRef<ECMapHandle>();
    render(<ECMap ref={ref} />);
    await waitFor(() => expect(view.setUserLocation).toHaveBeenCalled());
    let finishRoute: (value: unknown) => void;
    mocks.calculateMapRoute.mockImplementation(() => new Promise((resolve) => { finishRoute = resolve; }));
    const pendingRoute = ref.current.showRoute(place, "walk");
    await waitFor(() => expect(mocks.calculateMapRoute).toHaveBeenCalled());
    act(() => ref.current.clearRoute());
    await act(async () => {
      finishRoute({ etaSec: 1, distance: 1, geometry: [coordinate], steps: [] });
      expect(await pendingRoute).toBeNull();
    });
    expect(view.setRoute).not.toHaveBeenCalled();
  });

  it("ignores a late location result after unmount", async () => {
    let finishLocation: (value: unknown) => void;
    mocks.getCurrentLocation.mockImplementation(() => new Promise((resolve) => { finishLocation = resolve; }));
    const onLocation = vi.fn();
    const rendered = render(<ECMap onUserLocation={onLocation} />);
    await waitFor(() => expect(mocks.getCurrentLocation).toHaveBeenCalled());
    rendered.unmount();
    await act(async () => finishLocation({ coords: gps }));
    expect(mocks.createView).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  it("pauses the map's location watch during navigation and resumes it afterward", async () => {
    const ref = createRef<ECMapHandle>();
    const rendered = render(<ECMap ref={ref} />);
    await waitFor(() => expect(mocks.watchLocation).toHaveBeenCalledTimes(1));
    await act(async () => ref.current.setShowsUserLocation(false));
    expect(mocks.stopLocationWatch).toHaveBeenCalledTimes(1);
    await act(async () => ref.current.setShowsUserLocation(true));
    expect(mocks.watchLocation).toHaveBeenCalledTimes(2);
    rendered.unmount();
    expect(mocks.stopLocationWatch).toHaveBeenCalledTimes(2);
    expect(view.destroy).toHaveBeenCalledTimes(1);
  });

  it("allows retrying a failed renderer initialization", async () => {
    const failedView = makeView();
    failedView.ready = Promise.reject(new Error("Style unavailable"));
    void failedView.ready.catch(() => {});
    mocks.createView.mockReturnValueOnce(failedView).mockReturnValue(view);
    render(<ECMap />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(view.setUserLocation).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(failedView.destroy).toHaveBeenCalled();
  });
});
