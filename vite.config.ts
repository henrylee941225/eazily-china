import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
      process.env.CAPACITOR_BUILD !== "true" && VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: {
        enabled: false,
      },
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        navigateFallback: "/index.html",
        // Always fetch fresh index.html for the ops portal so email deep links
        // (/ops?task=…) never load a stale precached shell that predates the
        // route. OAuth and API paths must also bypass the SW.
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/ops(\/|$|\?)/],
        cleanupOutdatedCaches: true,
        // Take over immediately so a newly published build activates on the
        // next navigation rather than the visit after. Paired with an
        // in-app "Refresh" toast (see src/main.tsx) so users can adopt the
        // new bundle without waiting for a natural reload.
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
