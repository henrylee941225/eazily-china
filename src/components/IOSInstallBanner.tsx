import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { isCapacitorApp } from "@/integrations/capacitor";

const STORAGE_KEY = "ios-install-banner-dismissed";

export const IOSInstallBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isCapacitorApp()) return;

    const ua = window.navigator.userAgent;
    // iOS detection (iPhone/iPad/iPod). Also handle iPadOS reporting as Mac with touch.
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Mac") && "ontouchend" in document);

    // Safari (exclude Chrome/Firefox/Edge/Opera on iOS which all use WebKit but identify themselves)
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua);

    // Already installed (running in standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - non-standard iOS Safari property
      window.navigator.standalone === true;

    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";

    if (isIOS && isSafari && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Eazily China"
      className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Share className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 text-sm leading-snug text-foreground">
        Install <span className="font-semibold">Eazily China</span>: tap the
        Share button, then <span className="font-semibold">"Add to Home Screen"</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install banner"
        className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default IOSInstallBanner;
