import { build } from "vite";

// Keep production environment settings while excluding the web service worker.
process.env.CAPACITOR_BUILD = "true";
await build({ build: { outDir: "dist-native" } });
