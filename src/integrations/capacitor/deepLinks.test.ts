import { describe, expect, it } from "vitest";
import { parseNativeDeepLink } from "./deepLinks";

describe("native deep links", () => {
  it("extracts the auth session without putting credentials into the router", () => {
    const link = parseNativeDeepLink(
      "com.eazilychina.app://app/profile-setup?next=%2Fbookings#access_token=access&refresh_token=refresh&type=signup",
    );
    expect(link).toMatchObject({
      path: "/profile-setup?next=%2Fbookings",
      session: { access_token: "access", refresh_token: "refresh" },
    });
  });

  it("supports password recovery with a PKCE code", () => {
    expect(parseNativeDeepLink("com.eazilychina.app://app/reset-password?code=auth-code")).toMatchObject({
      path: "/reset-password",
      code: "auth-code",
      session: null,
    });
  });

  it.each([
    "https://example.com/reset-password",
    "com.eazilychina.app://other/reset-password",
    "com.eazilychina.app://app//example.com",
    "com.eazilychina.app://app/%2Fexample.com",
    "com.eazilychina.app://app/%5Cexample.com",
    "invalid-url",
  ])("rejects an untrusted link: %s", (url) => {
    expect(parseNativeDeepLink(url)).toBeNull();
  });

  it("does not create a session from an incomplete token pair", () => {
    expect(parseNativeDeepLink("com.eazilychina.app://app/auth#access_token=access")?.session).toBeNull();
  });

  it("returns an expired-link error without leaving it in the route", () => {
    expect(parseNativeDeepLink("com.eazilychina.app://app/auth?error=access_denied&error_description=Expired")).toMatchObject({
      path: "/auth",
      error: "Expired",
    });
  });
});
