import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-a" } }, loading: false }),
}));

const torch = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
}));
const invoke = vi.hoisted(() => vi.fn());

vi.mock("@capawesome/capacitor-torch", () => ({ Torch: torch }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import Translate from "./Translate";

describe("Translate camera mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = vi.fn();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it("shows the camera controls without the bottom tab bar and restores it on exit", () => {
    render(<MemoryRouter><Translate /></MemoryRouter>);

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));

    expect(screen.getByRole("button", { name: "Close camera" }).closest(".fixed")).toHaveClass("bg-white");
    expect(screen.getByRole("button", { name: "Take photo" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close camera" }));
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("starts the camera and toggles flash", async () => {
    torch.isAvailable.mockResolvedValue({ available: true });
    torch.enable.mockResolvedValue(undefined);
    torch.disable.mockResolvedValue(undefined);
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    render(<MemoryRouter><Translate /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Flash" }));

    await waitFor(() => expect(torch.enable).toHaveBeenCalledWith({ stream }));
    expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Flash" }));
    await waitFor(() => expect(torch.disable).toHaveBeenCalledWith({ stream }));
    expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "false");
  });

  it("uses the preview track when it supports torch constraints", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    const track = {
      stop: vi.fn(),
      getCapabilities: () => ({ torch: true }),
      applyConstraints,
    };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    render(<MemoryRouter><Translate /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Flash" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "true"));
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(torch.enable).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Flash" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Flash" })).toHaveAttribute("aria-pressed", "false"));
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: false }] });
  });

  it("keeps the captured photo and recognition result visible until retaking", async () => {
    invoke.mockResolvedValue({
      data: {
        source: "你好\n世界",
        translated: "Hello\nThis is the complete translation of the photo.",
        pinyin: "nǐ hǎo\nshì jiè",
      },
      error: null,
    });
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,captured");
    vi.stubGlobal("Image", class {
      width = 640;
      height = 480;
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });

    render(<MemoryRouter><Translate /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    const video = document.querySelector("video");
    expect(video).not.toBeNull();
    Object.defineProperty(video, "videoWidth", { value: 640 });
    Object.defineProperty(video, "videoHeight", { value: 480 });
    fireEvent.click(screen.getByText("Tap to start camera"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Take photo" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));

    expect(screen.getByAltText("Captured photo")).toBeVisible();
    expect(screen.queryByText("Tap to start camera")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/This is the complete translation/)).toBeVisible());
    const results = screen.getByRole("region", { name: "Translation results" });
    expect(results).toHaveClass("overflow-y-auto");
    expect(screen.getByText(/This is the complete translation/)).toHaveClass("whitespace-pre-wrap");
    expect(screen.getByText(/世界/)).toHaveClass("whitespace-pre-wrap");
    expect(screen.getByText(/shì jiè/)).toBeVisible();
    expect(track.stop).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("translate-image", {
      body: { image: "data:image/jpeg;base64,captured", from: "zh", to: expect.any(String) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Retake photo" }));
    await waitFor(() => expect(screen.queryByAltText("Captured photo")).not.toBeInTheDocument());
  });

  it("shows the complete gallery translation in the scrollable results view", async () => {
    invoke.mockResolvedValue({
      data: { source: "菜单第一项 / 菜单第二项", translated: "First menu item\nSecond menu item" },
      error: null,
    });
    vi.stubGlobal("Image", class {
      width = 640;
      height = 480;
      onload: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });

    render(<MemoryRouter><Translate /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    const galleryInput = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(galleryInput, {
      target: { files: [new File(["image"], "menu.jpg", { type: "image/jpeg" })] },
    });

    const translated = await screen.findByText(/Second menu item/);
    expect(translated).toHaveClass("whitespace-pre-wrap");
    expect(screen.getByText(/菜单第二项/)).toBeVisible();
    expect(screen.getByRole("region", { name: "Translation results" })).toHaveClass("overflow-y-auto");
    expect(screen.getByAltText("Captured photo")).toBeVisible();
  });
});
