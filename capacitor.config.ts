import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.eazilychina.app",
  appName: "Eazily China",
  webDir: "dist-native",
  backgroundColor: "#ffffff",
  appendUserAgent: "EazilyChina/1.0",
  ios: {
    contentInset: "never",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "LIGHT",
    },
    Keyboard: {
      resize: "native",
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#ffffff",
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
