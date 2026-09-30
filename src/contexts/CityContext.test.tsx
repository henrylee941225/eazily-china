import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentLocation: vi.fn() }));
vi.mock("@/integrations/capacitor/geolocation", () => ({ getCurrentLocation: mocks.getCurrentLocation }));

import { CityProvider, useCity } from "./CityContext";
import { getCityById } from "@/data/cities";

const Probe = () => {
  const { cityId, setCityId } = useCity();
  return <div>
    <span data-testid="city">{cityId}</span>
    <button onClick={() => setCityId("shanghai")}>Select Shanghai</button>
  </div>;
};

describe("CityProvider location", () => {
  beforeEach(() => vi.resetAllMocks());

  it("selects the nearest city from the shared location provider", async () => {
    const [latitude, longitude] = getCityById("beijing").center;
    mocks.getCurrentLocation.mockResolvedValue({ coords: { latitude, longitude } });
    render(<CityProvider><Probe /></CityProvider>);
    await waitFor(() => expect(screen.getByTestId("city")).toHaveTextContent("beijing"));
    expect(mocks.getCurrentLocation).toHaveBeenCalledWith(expect.objectContaining({ enableHighAccuracy: false }));
  });

  it("keeps a manual city choice when location resolves later", async () => {
    let resolveLocation: (value: unknown) => void;
    mocks.getCurrentLocation.mockImplementation(() => new Promise((resolve) => { resolveLocation = resolve; }));
    render(<CityProvider><Probe /></CityProvider>);
    await act(async () => { screen.getByRole("button", { name: "Select Shanghai" }).click(); });
    const [latitude, longitude] = getCityById("beijing").center;
    await act(async () => resolveLocation({ coords: { latitude, longitude } }));
    expect(screen.getByTestId("city")).toHaveTextContent("shanghai");
  });
});
