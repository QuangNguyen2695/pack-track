import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.ionic.starter",
  appName: "PackTrack",
  webDir: "www",
  server: {
    androidScheme: 'http'
  },
  ios: { backgroundColor: "#00000000" }, // WebView trong suốt
};

export default config;
