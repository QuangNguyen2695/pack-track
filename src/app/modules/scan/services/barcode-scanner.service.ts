import { Injectable } from "@angular/core";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, Result } from "@zxing/library";

@Injectable({ providedIn: "root" })
export class BarcodeScannerService {
  private readonly zxing = new BrowserMultiFormatReader(this.buildHints());

  private buildHints(): Map<DecodeHintType, any> {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.QR_CODE,
    ]);
    // hints.set(DecodeHintType.ASSUME_GS1, true); // bật nếu dùng GS1
    return hints;
  }

  async decodeFast(dataUrl: string): Promise<Result | null> {
    return this.zxing.decodeFromImageUrl(dataUrl).catch(() => null);
  }

  // vẽ lại dataURL lên canvas với scale/crop rồi trả dataURL mới
  private async transformDataUrl(dataUrl: string, opts: { scale?: number; cropCenterPercent?: number } = {}): Promise<string> {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = dataUrl;
    });

    const scale = opts.scale ?? 1;
    const crop = Math.min(Math.max(opts.cropCenterPercent ?? 100, 10), 100);

    const cropW = Math.floor((img.width * crop) / 100);
    const cropH = Math.floor((img.height * crop) / 100);
    const sx = Math.floor((img.width - cropW) / 2);
    const sy = Math.floor((img.height - cropH) / 2);

    const outW = Math.floor(cropW * scale);
    const outH = Math.floor(cropH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    (ctx as any).imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  // cố gắng decode với nhiều mức (gốc → crop 80% → crop 80% + upscale 1.5x → upscale 2x toàn ảnh)
  async decodeRobust(dataUrl: string): Promise<Result | null> {
    let r = await this.decodeFast(dataUrl);
    if (r) return r;

    const center80 = await this.transformDataUrl(dataUrl, { cropCenterPercent: 80 });
    r = await this.decodeFast(center80);
    if (r) return r;

    const up1p5 = await this.transformDataUrl(dataUrl, { cropCenterPercent: 80, scale: 1.5 });
    r = await this.decodeFast(up1p5);
    if (r) return r;

    const up2 = await this.transformDataUrl(dataUrl, { scale: 2 });
    r = await this.decodeFast(up2);
    return r ?? null;
  }
}
