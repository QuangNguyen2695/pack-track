import { Injectable } from "@angular/core";
import { CameraPreview, CameraPreviewOptions, CameraSampleOptions } from "@capacitor-community/camera-preview";

export type FlashMode = "off" | "on" | "torch";

@Injectable({ providedIn: "root" })
export class CameraPreviewService {
  async start(opts: CameraPreviewOptions): Promise<void> {
    await CameraPreview.start(opts);
  }

  async stop(): Promise<void> {
    try {
      await CameraPreview.stopRecordVideo();
    } catch {}
    try {
      await CameraPreview.stop();
    } catch {}
  }

  async captureSampleBase64(quality = 85): Promise<string | null> {
    const sampleOpts: CameraSampleOptions = { quality };
    const { value } = await CameraPreview.captureSample(sampleOpts);
    return value ?? null; // base64
  }

  async startRecord(): Promise<void> {
    await CameraPreview.startRecordVideo({});
  }

  async stopRecord(): Promise<string | undefined> {
    const res: any = await CameraPreview.stopRecordVideo();
    const filePath: string | undefined = res?.value || res?.filePath || res?.videoFilePath || (typeof res === "string" ? res : undefined);
    return filePath;
  }

  async setFlashMode(mode: FlashMode): Promise<void> {
    // một số version nhận object, một số nhận string
    try {
      await (CameraPreview as any).setFlashMode({ flashMode: mode });
    } catch {
      await (CameraPreview as any).setFlashMode(mode);
    }
  }
}
