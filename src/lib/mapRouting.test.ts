import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));

import { calculateMapRoute } from "./mapRouting";

const origin = { latitude: 31.2304, longitude: 121.4737 };
const destination = { latitude: 31.2404, longitude: 121.4837 };

describe("map routing", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("uses the AMap route response for map geometry and navigation steps", async () => {
    mocks.invoke.mockResolvedValue({ data: {
      distance_m: 1800,
      duration_s: 720,
      points: [[121.4737, 31.2304], [121.4837, 31.2404]],
      steps: [{ instruction: "Walk east", distance_m: 1800, points: [[121.4737, 31.2304], [121.4837, 31.2404]] }],
    }, error: null });

    await expect(calculateMapRoute(origin, destination, "walk", "021")).resolves.toEqual({
      distance: 1800,
      etaSec: 720,
      geometry: [origin, destination],
      steps: [{ instructions: "Walk east", distance: 1800, path: [origin, destination] }],
    });
    expect(mocks.invoke).toHaveBeenCalledWith("amap-route", { body: {
      origin: "121.473700,31.230400",
      destination: "121.483700,31.240400",
      mode: "walking",
      city: "021",
    } });
  });

  it("returns no route when AMap is unavailable", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("Function not found") });
    await expect(calculateMapRoute(origin, destination, "drive", "021")).resolves.toBeNull();
  });
});
