import { registerPlugin, Capacitor, PluginListenerHandle } from "@capacitor/core";

export interface StartPreviewOptions {
  toBack?: boolean; // Android: render preview phía sau WebView (cần webview trong suốt)
  withAudio?: boolean; // Ghi kèm audio hay không
}

export interface StartRecordingOptions {
  fileNamePrefix?: string; // Tiền tố tên file
  quality?: "sd" | "hd" | "fhd" | "uhd";
  saveToGallery?: boolean; // (tùy nền tảng)
  isReturn?: boolean; // (Android) nếu true sẽ lưu vào thư mục riêng cho video trả hàng
}

export interface StopRecordingResult {
  uri: string; // Android: content:// URI (MediaStore), iOS: file:/// URL
}

export interface BarcodeEvent {
  value: string;
  format: string; // "QR_CODE", "CODE_128", ...
  ts: number; // epoch ms
}

export interface SetTimestampOverlayOptions {
  enabled: boolean; // bật/tắt đốt timestamp trực tiếp vào video (Android)
  format?: string; // "yyyy-MM-dd HH:mm:ss" (mặc định)
  textSizeSp?: number; // kích thước chữ theo sp (mặc định 18)
  color?: string; // mã màu "#FFFFFFFF" (ARGB/RGB)
  marginDp?: number; // lề theo dp (mặc định 12)
}

export interface SetTorchOptions {
  on: boolean;
}

export interface CameraBarcodePlugin {
  startPreview(options?: StartPreviewOptions): Promise<void>;
  startRecording(options?: StartRecordingOptions): Promise<{ recordingId: string }>;
  stopRecording(): Promise<StopRecordingResult>;
  setTorch(options: SetTorchOptions): Promise<void>;
  /** Helper method for backward compatibility */
  setTorchState(on: boolean): Promise<void>;
  setAudioEnabled(enabled: boolean): Promise<void>;

  /** NEW: Bật/tắt & cấu hình timestamp overlay (đốt trực tiếp vào video trên Android) */
  setTimestampOverlay(options: SetTimestampOverlayOptions): Promise<void>;

  addListener(eventName: "barcode", listenerFunc: (event: BarcodeEvent) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// ---- Đăng ký plugin ----
const _CameraBarcode = registerPlugin<CameraBarcodePlugin>("CameraBarcode");

// ---- (Tuỳ chọn) wrapper an toàn khi chạy web/dev (không native) ----
function isNative() {
  try {
    return typeof Capacitor?.isNativePlatform === "function"
      ? Capacitor.isNativePlatform()
      : (Capacitor as any)?.platform && (Capacitor as any).platform !== "web";
  } catch {
    return false;
  }
}

/**
 * Export đối tượng dùng trong app.
 * Trên web (không native), các method vẫn tồn tại nhưng sẽ throw lỗi có ý nghĩa.
 */
export const CameraBarcode: CameraBarcodePlugin = {
  async startPreview(options?: StartPreviewOptions) {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    return _CameraBarcode.startPreview(options);
  },
  async startRecording(options?: StartRecordingOptions) {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    return _CameraBarcode.startRecording(options);
  },
  async stopRecording() {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    return _CameraBarcode.stopRecording();
  },
  async setTorch(options: SetTorchOptions) {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    return (_CameraBarcode as any).setTorch(options);
  },
  /** Helper method for backward compatibility */
  async setTorchState(on: boolean) {
    return this.setTorch({ on });
  },
  async setAudioEnabled(enabled: boolean) {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    // Call native plugin with object parameter as expected by Android implementation
    return (_CameraBarcode as any).setAudioEnabled({ on: enabled });
  },
  async setTimestampOverlay(options: SetTimestampOverlayOptions) {
    if (!isNative()) throw new Error("CameraBarcode is only available on native platforms.");
    // defaults (khớp native)
    const payload: SetTimestampOverlayOptions = {
      enabled: options.enabled,
      format: options.format ?? "yyyy-MM-dd HH:mm:ss",
      textSizeSp: options.textSizeSp ?? 18,
      color: options.color ?? "#FFFFFFFF",
      marginDp: options.marginDp ?? 12,
    };
    return _CameraBarcode.setTimestampOverlay(payload);
  },
  async addListener(eventName: "barcode", listenerFunc: (event: BarcodeEvent) => void) {
    // Cho phép debug trên web: có thể return dummy handle để không crash
    if (!isNative()) {
      return {
        remove: async () => void 0,
      } as unknown as PluginListenerHandle;
    }
    return _CameraBarcode.addListener(eventName, listenerFunc);
  },
  async removeAllListeners() {
    if (!isNative()) return;
    return _CameraBarcode.removeAllListeners();
  },
};

export default CameraBarcode;
