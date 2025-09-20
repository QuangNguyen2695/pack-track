export interface StartPreviewOptions {
    toBack?: boolean;
    withAudio?: boolean;
}
export interface StartRecordingOptions {
    fileNamePrefix?: string;
    quality?: "sd" | "hd" | "fhd" | "uhd";
    saveToGallery?: boolean;
}
export interface StopRecordingResult {
    uri: string;
}
export interface BarcodeEvent {
    value: string;
    format: string;
    ts: number;
}
export interface CameraBarcodePlugin {
    startPreview(options?: StartPreviewOptions): Promise<void>;
    startRecording(options?: StartRecordingOptions): Promise<{
        recordingId: string;
    }>;
    stopRecording(): Promise<StopRecordingResult>;
    setTorch(on: boolean): Promise<void>;
    addListener(eventName: "barcode", listenerFunc: (event: BarcodeEvent) => void): Promise<void>;
    removeAllListeners(): Promise<void>;
}
