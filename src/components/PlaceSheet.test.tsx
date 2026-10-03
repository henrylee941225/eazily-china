import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  share: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.isNativePlatform } }));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/ui/non-modal-drawer", () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Drawer: {
      Root: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
      Portal: Container,
      Content: Container,
      Title: Container,
      Description: Container,
    },
  };
});

import { PlaceSheet } from "./PlaceSheet";

const place = {
  name: "The Bund",
  formattedAddress: "Zhongshan East 1st Road, Shanghai",
  coordinate: { latitude: 31.2401, longitude: 121.4902 },
};

const renderSheet = () => render(
  <MemoryRouter>
    <PlaceSheet place={place} category={null} userCoord={null} mapHandle={null} onClose={vi.fn()} />
  </MemoryRouter>,
);

describe("place sharing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });

  it("opens the native share sheet with the exact place link", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.share.mockResolvedValue({ activityType: "" });

    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({
      title: "The Bund",
      text: "Zhongshan East 1st Road, Shanghai",
      url: "https://app.eazilychina.com/map?lat=31.2401&lng=121.4902&name=The+Bund&address=Zhongshan+East+1st+Road%2C+Shanghai",
    })));
  });

  it("copies the place link when web sharing is unavailable", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(
      "https://app.eazilychina.com/map?lat=31.2401&lng=121.4902",
    )));
    expect(mocks.toast).toHaveBeenCalledWith("Place link copied");
  });
});
