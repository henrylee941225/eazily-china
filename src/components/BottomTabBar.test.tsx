import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  addListener: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@capacitor/keyboard", () => ({ Keyboard: { addListener: native.addListener } }));
vi.mock("@/integrations/capacitor", () => ({ isCapacitorApp: () => true }));
vi.mock("@/integrations/median", () => ({ triggerHaptic: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ session: null }) }));

import { BottomTabBar } from "./BottomTabBar";

describe("BottomTabBar keyboard visibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.listeners.clear();
    native.addListener.mockImplementation(async (event: string, listener: () => void) => {
      native.listeners.set(event, listener);
      return { remove: native.remove };
    });
  });

  it("stays out of view while the keyboard is open and returns after it closes", async () => {
    const view = render(<MemoryRouter><BottomTabBar /></MemoryRouter>);
    const tabBar = screen.getByRole("navigation", { name: "Primary" });
    await waitFor(() => expect(native.addListener).toHaveBeenCalledTimes(2));

    act(() => native.listeners.get("keyboardWillShow")?.());
    expect(tabBar).toHaveClass("invisible");
    expect(tabBar).toHaveAttribute("aria-hidden", "true");

    act(() => native.listeners.get("keyboardDidHide")?.());
    expect(tabBar).not.toHaveClass("invisible");
    expect(tabBar).toHaveAttribute("aria-hidden", "false");

    view.unmount();
    expect(native.remove).toHaveBeenCalledTimes(2);
  });
});
