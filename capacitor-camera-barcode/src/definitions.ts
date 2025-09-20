export interface StartPreviewOptions {
  toBack?: boolean; // Android: xem preview phía sau WebView (cần webview trong suốt)
  withAudio?: boolean; // Ghi kèm audio hay không
}

export interface StartRecordingOptions {
  fileNamePrefix?: string; // Tiền tố tên file
  quality?: "sd" | "hd" | "fhd" | "uhd"; // Android: QualitySelector
  saveToGallery?: boolean; // iOS: lưu Photos; Android: MediaStore (mặc định true)
}

export interface StopRecordingResult {
  uri: string; // Android: content:// URI (MediaStore), iOS: file:/// URL
}

export interface BarcodeEvent {
  value: string;
  format: string; // ví dụ: "QR_CODE", "CODE_128"
  ts: number; // epoch ms
}

export interface CameraBarcodePlugin {
  startPreview(options?: StartPreviewOptions): Promise<void>;
  startRecording(options?: StartRecordingOptions): Promise<{ recordingId: string }>;
  stopRecording(): Promise<StopRecordingResult>;
  setTorch(on: boolean): Promise<void>;
  addListener(eventName: "barcode", listenerFunc: (event: BarcodeEvent) => void): Promise<void>;
  removeAllListeners(): Promise<void>;
}
