import { registerPlugin, PluginListenerHandle, Capacitor } from "@capacitor/core";

export interface CameraXScannerPlugin {
  checkPermissions(): Promise<{ camera: boolean; microphone: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;

  startAnalysis(opts?: { enableTorch?: boolean }): Promise<{ started: boolean }>;
  stopAnalysis(): Promise<{ stopped: boolean }>;

  startRecording(opts?: { withAudio?: boolean }): Promise<{ started: boolean; filePath: string }>;
  stopRecording(): Promise<{ stopped: boolean }>;

  addListener(eventName: "barcodeScanned", listener: (e: { rawValue: string; format: number }) => void): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

// Proxy dự phòng (web/dev hoặc khi native chưa available)
const proxy = registerPlugin<CameraXScannerPlugin>("CameraXScanner");

// Lấy native **tại thời điểm gọi**
function getNative(): any {
  const g: any = globalThis as any;
  // isNativePlatform có từ Capacitor v5
  const isNative =
    typeof Capacitor?.isNativePlatform === "function" ? Capacitor.isNativePlatform() : !!g?.Capacitor?.platform && g.Capacitor.platform !== "web";

  if (!isNative) return undefined;
  return g?.Capacitor?.Plugins?.CameraXScanner;
}

// Lazy wrapper: mỗi method đều chọn native nếu có, ngược lại dùng proxy
export const CameraXScanner: CameraXScannerPlugin = {
  async checkPermissions() {
    const n = getNative();
    return (n ?? proxy).checkPermissions();
  },
  async requestPermissions() {
    const n = getNative();
    return (n ?? proxy).requestPermissions();
  },
  async startAnalysis(opts?: { enableTorch?: boolean }) {
    const n = getNative();
    return (n ?? proxy).startAnalysis(opts);
  },
  async stopAnalysis() {
    const n = getNative();
    return (n ?? proxy).stopAnalysis();
  },
  async startRecording(opts?: { withAudio?: boolean }) {
    const n = getNative();
    return (n ?? proxy).startRecording(opts);
  },
  async stopRecording() {
    const n = getNative();
    return (n ?? proxy).stopRecording();
  },
  async addListener(eventName: "barcodeScanned", listener: (e: { rawValue: string; format: number }) => void) {
    const n = getNative();
    return (n ?? proxy).addListener(eventName, listener);
  },
  async removeAllListeners() {
    const n = getNative();
    return (n ?? proxy).removeAllListeners();
  },
};
