import { Injectable } from "@angular/core";
import { CameraPreview, CameraPreviewOptions, CameraSampleOptions } from "@capacitor-community/camera-preview";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";

export type FlashMode = "off" | "on" | "torch";

@Injectable({ providedIn: "root" })
export class CameraPreviewService {
  async start(opts: CameraPreviewOptions): Promise<void> {
    await CameraPreview.start(opts);
  }

  private normalizeUri(path: string): string {
    if (!path) return path;
    // đã có scheme rồi
    if (/^[a-zA-Z]+:\/\//.test(path)) return path;
    // đường tuyệt đối kiểu /data/user/0/...
    if (path.startsWith("/")) return "file://" + path;
    // còn lại để nguyên
    return path;
  }

  async captureToFile(quality = 85): Promise<string | null> {
    const res: any = await (CameraPreview as any).capture({ quality });
    let path: string | undefined = res?.value || res?.filePath || (typeof res === "string" ? res : undefined);
    if (!path) return null;
    return this.normalizeUri(path); // ✅ đảm bảo có file://
  }

async pathToBase64Any(rawPath: string): Promise<string | null> {
  if (!rawPath) return null;
  const path = this.normalizeUri(rawPath);  // ✅ chuẩn hoá trước

  // 1) thử đọc nhanh bằng Filesystem nếu là file://
  if (path.startsWith('file://')) {
    try {
      const { data } = await Filesystem.readFile({ path: path.replace('file://', '') });
      if (typeof data === "string" && data) return data; // base64 thuần
    } catch {}
  }

  // 2) fallback: convertFileSrc → fetch → FileReader (ăn được cả content://)
  try {
    const url = Capacitor.convertFileSrc(path);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('fetch failed');
    const blob = await resp.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return base64 || null;
  } catch (e) {
    console.warn('[pathToBase64Any] fallback failed', e);
    return null;
  }
}

  async deleteFile(path: string): Promise<void> {
    try {
      if (!path.startsWith("file://")) return;
      await Filesystem.deleteFile({ path: path.replace("file://", "") });
    } catch {}
  }

  async trySetContinuousFocus() {
    try {
      await (CameraPreview as any).setFocusMode?.({ focusMode: "continuous" });
    } catch {}
    try {
      await (CameraPreview as any).tapToFocus?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } catch {}
  }
  async trySetZoom(z = 1.3) {
    try {
      await (CameraPreview as any).setZoom?.({ zoom: z });
    } catch {}
  }

  async stop(): Promise<void> {
    try {
      await CameraPreview.stopRecordVideo();
    } catch {}
    try {
      await CameraPreview.stop();
    } catch {}
  }

  // helper đo độ nét (Tenengrad đơn giản) – nhẹ hơn Laplacian
  async sharpnessScore(dataUrl: string): Promise<number> {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const W = 160,
      H = 120; // nhỏ để tính nhanh
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    (ctx as any).imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let sum = 0,
      cnt = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i0 = (y * W + x) * 4;
        const g = 0.299 * data[i0] + 0.587 * data[i0 + 1] + 0.114 * data[i0 + 2];
        const gx =
          0.299 * data[i0 + 4] + 0.587 * data[i0 + 5] + 0.114 * data[i0 + 6] - (0.299 * data[i0 - 4] + 0.587 * data[i0 - 3] + 0.114 * data[i0 - 2]);
        const gy =
          0.299 * data[i0 + W * 4] +
          0.587 * data[i0 + W * 4 + 1] +
          0.114 * data[i0 + W * 4 + 2] -
          (0.299 * data[i0 - W * 4] + 0.587 * data[i0 - W * 4 + 1] + 0.114 * data[i0 - W * 4 + 2]);
        sum += gx * gx + gy * gy;
        cnt++;
      }
    }
    return sum / (cnt || 1);
  }

  async avgLuma(dataUrl: string): Promise<number> {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const W = 64,
      H = 48;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return sum / (data.length / 4);
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
