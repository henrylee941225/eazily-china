import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  native: false,
  signInWithOAuth: vi.fn(),
  getSession: vi.fn(),
  lovableSignInWithOAuth: vi.fn(),
  openExternalUrl: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: auth.signInWithOAuth, getSession: auth.getSession } },
}));
vi.mock("@/integrations/lovable", () => ({
  lovable: { auth: { signInWithOAuth: auth.lovableSignInWithOAuth } },
}));
vi.mock("@/integrations/capacitor", () => ({
  isCapacitorApp: () => auth.native,
  getAuthRedirectUrl: (path: string) => `${auth.native ? "com.eazilychina.app://app" : "https://example.com"}${path}`,
  openExternalUrl: auth.openExternalUrl,
}));
vi.mock("@/integrations/median", () => ({ triggerHaptic: vi.fn() }));
vi.mock("@/components/BottomTabBar", () => ({ BottomTabBar: () => null }));
vi.mock("sonner", () => ({ toast: { error: auth.toastError } }));

import Auth from "./Auth";

const RouteProbe = () => {
  const location = useLocation();
  return <div data-testid="route">{location.pathname}</div>;
};

const mount = () => render(
  <MemoryRouter initialEntries={["/auth?next=%2Fbookings"]}>
    <Auth />
    <RouteProbe />
  </MemoryRouter>,
);

describe("social sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    auth.native = false;
    auth.openExternalUrl.mockResolvedValue(undefined);
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
  });

  it("starts managed Apple sign-in on the web and navigates after the session is saved", async () => {
    auth.lovableSignInWithOAuth.mockResolvedValue({ tokens: { access_token: "token", refresh_token: "refresh" }, error: null });
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Apple" }));

    await waitFor(() => expect(screen.getByTestId("route")).toHaveTextContent("/bookings"));
    expect(auth.lovableSignInWithOAuth).toHaveBeenCalledExactlyOnceWith("apple", {
      redirect_uri: "https://example.com/bookings",
    });
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("lets the managed web flow redirect the page", async () => {
    auth.lovableSignInWithOAuth.mockResolvedValue({ redirected: true, error: null });
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Google" }));

    await waitFor(() => expect(auth.lovableSignInWithOAuth).toHaveBeenCalledOnce());
    expect(screen.getByTestId("route")).toHaveTextContent("/auth");
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("opens native Google sign-in in the system browser with a deep-link return", async () => {
    auth.native = true;
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Google" }));

    await waitFor(() => expect(auth.openExternalUrl).toHaveBeenCalledOnce());
    const url = new URL(auth.openExternalUrl.mock.calls[0][0]);
    const callback = new URL(url.searchParams.get("redirect_uri")!);
    expect(`${url.origin}${url.pathname}`).toBe("https://app.eazilychina.com/~oauth/initiate");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(callback.origin).toBe("null");
    expect(`${callback.protocol}//${callback.host}${callback.pathname}`).toBe("com.eazilychina.app://app/bookings");
    expect(callback.searchParams.get("oauth_state")).toBe(url.searchParams.get("state"));
    expect(url.searchParams.get("state")).toMatch(/^[a-f0-9]{32}$/);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(auth.lovableSignInWithOAuth).not.toHaveBeenCalled();
  });

  it("shows a provider error and re-enables the buttons", async () => {
    auth.lovableSignInWithOAuth.mockResolvedValue({ error: new Error("Provider unavailable") });
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Apple" }));

    await waitFor(() => expect(auth.toastError).toHaveBeenCalledExactlyOnceWith("Provider unavailable"));
    expect(screen.getByRole("button", { name: "Apple" })).toBeEnabled();
    expect(screen.getByTestId("route")).toHaveTextContent("/auth");
  });
});
