import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentLocation: vi.fn() }));
vi.mock("@/integrations/capacitor/geolocation", () => ({ getCurrentLocation: mocks.getCurrentLocation }));

import { CityProvider, useCity } from "./CityContext";
const Probe = () => {
  const { cityId, setCityId } = useCity();
  return <div>
    <span data-testid="city">{cityId}</span>
    <button onClick={() => setCityId("nanjing")}>Select Nanjing</button>
  </div>;
};

describe("CityProvider city selection", () => {
  beforeEach(() => vi.resetAllMocks());

  it("selects the nearest city from the current location", async () => {
    mocks.getCurrentLocation.mockResolvedValue({ coords: { latitude: 31.25, longitude: 120.75 } });
    render(<CityProvider><Probe /></CityProvider>);
    await waitFor(() => expect(screen.getByTestId("city")).toHaveTextContent("suzhou"));
    expect(mocks.getCurrentLocation).toHaveBeenCalledTimes(1);
  });

  it("keeps Shanghai when location is unavailable", async () => {
    mocks.getCurrentLocation.mockRejectedValue(new Error("Location unavailable"));
    render(<CityProvider><Probe /></CityProvider>);
    await waitFor(() => expect(mocks.getCurrentLocation).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("city")).toHaveTextContent("shanghai");
  });

  it("does not replace a manual city choice when location arrives later", async () => {
    let resolveLocation: (position: { coords: { latitude: number; longitude: number } }) => void;
    mocks.getCurrentLocation.mockImplementation(() => new Promise((resolve) => { resolveLocation = resolve; }));
    render(<CityProvider><Probe /></CityProvider>);
    await act(async () => { screen.getByRole("button", { name: "Select Nanjing" }).click(); });
    await act(async () => { resolveLocation({ coords: { latitude: 31.2330, longitude: 121.4760 } }); });
    expect(screen.getByTestId("city")).toHaveTextContent("nanjing");
  });
});
