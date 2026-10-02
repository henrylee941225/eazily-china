import { act, render, screen } from "@testing-library/react";
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

  it("starts in Shanghai without requesting location", async () => {
    mocks.getCurrentLocation.mockResolvedValue({ coords: { latitude: 32.0603, longitude: 118.7969 } });
    render(<CityProvider><Probe /></CityProvider>);
    await act(async () => {});
    expect(screen.getByTestId("city")).toHaveTextContent("shanghai");
    expect(mocks.getCurrentLocation).not.toHaveBeenCalled();
  });

  it("allows a manual city choice", async () => {
    render(<CityProvider><Probe /></CityProvider>);
    await act(async () => { screen.getByRole("button", { name: "Select Nanjing" }).click(); });
    expect(screen.getByTestId("city")).toHaveTextContent("nanjing");
  });
});
