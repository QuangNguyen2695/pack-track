import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "safetrack.app",
  appName: "SafeTrack",
  webDir: "www",
  server: {
    androidScheme: "http",
  },
  ios: { backgroundColor: "#00000000" }, // WebView trong suốt
  plugins: {
    "cordova-plugin-purchase": {
      // Google Play Store configuration
    },
  },
};

export default config;
