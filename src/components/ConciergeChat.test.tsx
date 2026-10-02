import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  listeners: new Map<string, () => void>(),
  addListener: vi.fn(),
  remove: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@capacitor/keyboard", () => ({ Keyboard: { addListener: native.addListener } }));
vi.mock("@/integrations/capacitor", () => ({ isCapacitorApp: () => true }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: native.getUser } },
}));

import { ConciergeChat } from "./ConciergeChat";

describe("ConciergeChat composer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    native.listeners.clear();
    native.getUser.mockResolvedValue({ data: { user: null } });
    native.addListener.mockImplementation(async (event: string, listener: () => void) => {
      native.listeners.set(event, listener);
      return { remove: native.remove };
    });
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  it("removes the safe-area gap while the keyboard is open and restores it after closing", async () => {
    const view = render(<MemoryRouter><ConciergeChat /></MemoryRouter>);
    const composer = screen.getByPlaceholderText("Ask anything…").closest("form")!.parentElement!;
    expect(composer).toHaveStyle({ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" });
    await waitFor(() => expect(native.addListener).toHaveBeenCalledTimes(2));

    act(() => native.listeners.get("keyboardWillShow")?.());
    expect(composer).toHaveStyle({ paddingBottom: "0.75rem" });

    act(() => native.listeners.get("keyboardDidHide")?.());
    expect(composer).toHaveStyle({ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" });

    view.unmount();
    expect(native.remove).toHaveBeenCalledTimes(2);
  });
});
