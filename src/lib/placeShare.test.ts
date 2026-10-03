import { describe, expect, it } from "vitest";
import { buildPlaceShareUrl, parseSharedPlace } from "./placeShare";

describe("place sharing links", () => {
  it("round trips the exact place and coordinates", () => {
    const url = new URL(buildPlaceShareUrl({
      name: "The Bund & River",
      formattedAddress: "Zhongshan East 1st Road, Shanghai",
      coordinate: { latitude: 31.2401, longitude: 121.4902 },
    }));

    expect(url.origin).toBe("https://app.eazilychina.com");
    expect(url.pathname).toBe("/map");
    expect(parseSharedPlace(url.searchParams)).toEqual({
      name: "The Bund & River",
      formattedAddress: "Zhongshan East 1st Road, Shanghai",
      coordinate: { latitude: 31.2401, longitude: 121.4902 },
    });
  });

  it("falls back to a map search when the place has no coordinates", () => {
    const url = new URL(buildPlaceShareUrl({ name: "The Bund" }));

    expect(url.searchParams.get("q")).toBe("The Bund");
    expect(parseSharedPlace(url.searchParams)).toBeNull();
  });

  it("rejects malformed shared coordinates", () => {
    expect(parseSharedPlace(new URLSearchParams("lat=91&lng=121&name=Invalid"))).toBeNull();
    expect(parseSharedPlace(new URLSearchParams("lat=&lng=121&name=Invalid"))).toBeNull();
    expect(parseSharedPlace(new URLSearchParams("lat=31&lng=NaN&name=Invalid"))).toBeNull();
  });
});
