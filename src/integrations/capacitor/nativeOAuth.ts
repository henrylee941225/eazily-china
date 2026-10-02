import { getAuthRedirectUrl } from "./index";

const MANAGED_OAUTH_URL = "https://app.eazilychina.com/~oauth/initiate";
const OAUTH_STATE_KEY = "eazilychina-native-oauth-state";

export const createNativeManagedOAuthUrl = (provider: "google" | "apple", destination: string): string => {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const callback = new URL(getAuthRedirectUrl(destination));
  callback.searchParams.set("oauth_state", state);
  window.localStorage.setItem(OAUTH_STATE_KEY, state);

  const url = new URL(MANAGED_OAUTH_URL);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_uri", callback.href);
  url.searchParams.set("state", state);
  return url.href;
};

export const consumeNativeOAuthDestination = (rawUrl: string, destination: string): string => {
  const callback = new URL(rawUrl);
  const state = callback.searchParams.get("oauth_state");
  if (!state) return destination;
  if (state !== window.localStorage.getItem(OAUTH_STATE_KEY)) {
    throw new Error("Invalid sign-in callback");
  }
  window.localStorage.removeItem(OAUTH_STATE_KEY);

  const path = new URL(destination, "https://app.eazilychina.com");
  path.searchParams.delete("oauth_state");
  return `${path.pathname}${path.search}`;
};
