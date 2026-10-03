import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAnnotations: vi.fn(),
  showSinglePlace: vi.fn(),
  centerOn: vi.fn(),
}));

vi.mock("@/components/ECMap", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef((_props, ref) => {
      useImperativeHandle(ref, () => mocks);
      return <div data-testid="map" />;
    }),
  };
});
vi.mock("@/components/PlaceSheet", () => ({
  PlaceSheet: ({ place }: { place: { name?: string } | null }) => <div data-testid="place-name">{place?.name}</div>,
}));
vi.mock("@/components/BottomTabBar", () => ({ BottomTabBar: () => null }));
vi.mock("@/components/ui/non-modal-drawer", () => ({
  DrawerBranch: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/contexts/CityContext", () => ({
  useCity: () => ({ cityId: "shanghai", city: { center: [31.23, 121.47] } }),
}));

import MapTest from "./MapTest";

describe("shared place links", () => {
  beforeEach(() => vi.resetAllMocks());

  it("opens the shared coordinates and place instead of searching", async () => {
    render(
      <MemoryRouter initialEntries={["/map?lat=31.2401&lng=121.4902&name=The+Bund&address=Shanghai"]}>
        <Routes>
          <Route path="/map" element={<MapTest />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("place-name")).toHaveTextContent("The Bund"));
    expect(mocks.showSinglePlace).toHaveBeenCalledWith({
      name: "The Bund",
      formattedAddress: "Shanghai",
      coordinate: { latitude: 31.2401, longitude: 121.4902 },
    }, undefined, "#1A1A1A");
    expect(mocks.centerOn).toHaveBeenCalledWith(31.2401, 121.4902, 800);
  });
});
