import Median from "median-js-bridge";

export { Median };

/** Trigger native haptic feedback when running inside the Median app */
export function triggerHaptic(
  style: "impactLight" | "impactMedium" | "impactHeavy" | "notificationSuccess" | "notificationWarning" | "notificationError" | "tick" | "click" | "double_click" = "impactLight"
): void {
  if (typeof window !== "undefined" && (window as any).isMedianApp) {
    try {
      Median.haptics.trigger({ style });
    } catch {
      // ignore if haptics aren't available
    }
  }
}

/** Detect if the app is running inside a Median native wrapper */
export function isMedianApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.indexOf("median") > -1
  );
}

/** Median-ready callback — useful for commands that must run immediately after the bridge initializes */
export function onMedianReady(callback: () => void): void {
  if (typeof window === "undefined") return;

  // If already ready, call immediately
  if (isMedianApp()) {
    callback();
    return;
  }

  // Otherwise wait for the injected bridge to initialize
  // @ts-expect-error Median global callback
  window.median_library_ready = () => {
    callback();
  };
}
