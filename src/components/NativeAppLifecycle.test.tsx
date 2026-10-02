import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  listeners: new Map<string, (event: { url: string }) => void>(),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  remove: vi.fn(),
  close: vi.fn(),
  setSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@capacitor/app", () => ({ App: native }));
vi.mock("@capacitor/browser", () => ({ Browser: { close: native.close } }));
vi.mock("@/integrations/capacitor", () => ({
  NATIVE_URL_SCHEME: "com.eazilychina.app",
  isCapacitorApp: () => true,
  openExternalUrl: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { setSession: native.setSession, exchangeCodeForSession: native.exchangeCodeForSession } },
}));

import { NativeAppLifecycle } from "./NativeAppLifecycle";

const RouteProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <div data-testid="route">{location.pathname}</div>
    <button onClick={() => navigate("/bookings")}>Bookings</button>
  </>;
};

const mount = () => render(<MemoryRouter initialEntries={["/"]}>
  <NativeAppLifecycle />
  <RouteProbe />
</MemoryRouter>);

describe("native auth callbacks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    native.listeners.clear();
    native.addListener.mockImplementation(async (event: string, listener: (event: { url: string }) => void) => {
      native.listeners.set(event, listener);
      return { remove: native.remove };
    });
    native.getLaunchUrl.mockResolvedValue(undefined);
    native.close.mockResolvedValue(undefined);
    native.setSession.mockResolvedValue({ error: null });
    native.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("handles a cold-start login once and preserves subsequent navigation", async () => {
    native.getLaunchUrl.mockResolvedValue({
      url: "com.eazilychina.app://app/profile-setup#access_token=access&refresh_token=refresh",
    });
    mount();
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/profile-setup"));
    fireEvent.click(screen.getByText("Bookings"));
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/bookings"));
    expect(native.getLaunchUrl).toHaveBeenCalledTimes(1);
    expect(native.setSession).toHaveBeenCalledTimes(1);
  });

  it("handles a warm-start recovery and deduplicates repeated callbacks", async () => {
    mount();
    await waitFor(() => expect(native.getLaunchUrl).toHaveBeenCalled());
    const event = { url: "com.eazilychina.app://app/reset-password?code=recovery-code" };
    act(() => {
      native.listeners.get("appUrlOpen")!(event);
      native.listeners.get("appUrlOpen")!(event);
    });
    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/reset-password"));
    expect(native.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("recovery-code");
    expect(native.setSession).not.toHaveBeenCalled();
  });

  it("validates a managed OAuth callback before saving its session", async () => {
    window.localStorage.setItem("eazilychina-native-oauth-state", "expected-state");
    mount();
    await waitFor(() => expect(native.getLaunchUrl).toHaveBeenCalled());
    act(() => native.listeners.get("appUrlOpen")!({
      url: "com.eazilychina.app://app/bookings?oauth_state=expected-state#access_token=access&refresh_token=refresh",
    }));

    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/bookings"));
    expect(native.setSession).toHaveBeenCalledExactlyOnceWith({ access_token: "access", refresh_token: "refresh" });
    expect(window.localStorage.getItem("eazilychina-native-oauth-state")).toBeNull();
  });

  it("rejects a managed OAuth callback with a mismatched state", async () => {
    window.localStorage.setItem("eazilychina-native-oauth-state", "expected-state");
    mount();
    await waitFor(() => expect(native.getLaunchUrl).toHaveBeenCalled());
    act(() => native.listeners.get("appUrlOpen")!({
      url: "com.eazilychina.app://app/bookings?oauth_state=wrong-state#access_token=access&refresh_token=refresh",
    }));

    expect(native.setSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("route")).toHaveTextContent("/");
  });

  it("ignores external callback URLs and removes listeners on unmount", async () => {
    const view = mount();
    await waitFor(() => expect(native.getLaunchUrl).toHaveBeenCalled());
    act(() => native.listeners.get("appUrlOpen")!({ url: "https://example.com/auth#access_token=access&refresh_token=refresh" }));
    expect(native.setSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("route")).toHaveTextContent("/");
    view.unmount();
    expect(native.remove).toHaveBeenCalledTimes(3);
  });
});
