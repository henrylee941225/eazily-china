import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export const NATIVE_URL_SCHEME = "com.eazilychina.app";

export const isCapacitorApp = (): boolean => Capacitor.isNativePlatform();

export const getAuthRedirectUrl = (path: string): string =>
  `${isCapacitorApp() ? `${NATIVE_URL_SCHEME}://app` : window.location.origin}${path}`;

export const openExternalUrl = async (url: string): Promise<void> => {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Unsupported external URL");
  }
  if (isCapacitorApp()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
