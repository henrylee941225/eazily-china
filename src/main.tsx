import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { toast } from "sonner";

// Global helper: true when running inside the Median native app wrapper
(window as any).isMedianApp =
  typeof navigator !== "undefined" &&
  navigator.userAgent.indexOf("median") > -1;

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker only in production builds, and never inside the
// Lovable preview iframe or on preview hosts. PWA features (offline,
// install prompt) will only work in the published/deployed version.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.app");

  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          let refreshToastShown = false;
          const showRefreshToast = () => {
            if (refreshToastShown) return;
            refreshToastShown = true;
            toast("A new version is available", {
              description: "Refresh to load the latest updates.",
              duration: Infinity,
              action: {
                label: "Refresh",
                onClick: () => window.location.reload(),
              },
            });
          };

          const watchWorker = (worker: ServiceWorker | null) => {
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              // Only prompt when there was a prior controller — otherwise this
              // is the first-ever SW install and there is nothing to refresh.
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                showRefreshToast();
              }
            });
          };

          // A worker may already be waiting/installing when we register (e.g.
          // returning tab after a deploy).
          watchWorker(registration.installing);
          if (registration.waiting && navigator.serviceWorker.controller) {
            showRefreshToast();
          }
          registration.addEventListener("updatefound", () => {
            watchWorker(registration.installing);
          });

          // Poll for updates hourly so long-lived tabs still pick up new
          // deploys without needing a natural navigation.
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        })
        .catch(() => {
          // ignore registration errors
        });
    });
  }
}
