import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  share: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: mocks.isNativePlatform } }));
vi.mock("@capacitor/share", () => ({ Share: { share: mocks.share } }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import GuideArticle from "./GuideArticle";

const renderGuide = () => render(
  <MemoryRouter initialEntries={["/guides/pre-arrival/pre-arrival-checklist"]}>
    <Routes>
      <Route path="/guides/:topicSlug/:guideSlug" element={<GuideArticle />} />
    </Routes>
  </MemoryRouter>,
);

describe("Guide sharing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });

  it("opens the native share sheet with a public guide URL", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.share.mockResolvedValue({ activityType: "" });

    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({
      title: "Pre-arrival checklist",
      url: "https://app.eazilychina.com/guides/pre-arrival/pre-arrival-checklist",
    })));
  });

  it("copies the public URL when browser sharing is unavailable", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      "https://app.eazilychina.com/guides/pre-arrival/pre-arrival-checklist",
    ));
    expect(mocks.toast).toHaveBeenCalledWith("Link copied");
  });

  it("copies the link when the native share sheet fails to open", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.share.mockRejectedValue(new Error("Share service unavailable"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      "https://app.eazilychina.com/guides/pre-arrival/pre-arrival-checklist",
    ));
    expect(mocks.toast).toHaveBeenCalledWith("Link copied");
  });
});
