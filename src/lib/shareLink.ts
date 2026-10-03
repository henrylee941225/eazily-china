import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

type SharePayload = { title: string; text: string; url: string };
type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

const isShareCancelled = (error: unknown): boolean => {
  const value = error as { name?: string; message?: string } | null;
  return value?.name === "AbortError" || /cancel/i.test(value?.message ?? "");
};

const copyLink = async (url: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const input = document.createElement("textarea");
    try {
      input.value = url;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }
};

export const shareLink = async (payload: SharePayload): Promise<ShareOutcome> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share(payload);
      return "shared";
    }
    if (navigator.share) {
      await navigator.share(payload);
      return "shared";
    }
  } catch (error) {
    if (isShareCancelled(error)) return "cancelled";
  }

  return await copyLink(payload.url) ? "copied" : "failed";
};
