import { Component, ElementRef, OnDestroy, OnInit, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { Platform, ToastController, AlertController } from "@ionic/angular";
import { Capacitor } from "@capacitor/core";

import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
import { LoadingService } from "@rsApp/shared/services/loadding-service/loading.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";

import { CameraBarcode } from "capacitor-camera-barcode";
import { Filesystem } from "@capacitor/filesystem";
import { ENV } from "src/environments/environment.development";

type RecState = "idle" | "previewing" | "starting" | "recording" | "stopping";

interface VideoMeta {
  orderCode: string | null;
  startRecordDate?: Date;
  endRecordDate?: Date;
  timeRecordedMs?: number;
  videoUri?: string;
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
}

@Component({
  selector: "app-scan-record",
  templateUrl: "./scan-record.page.html",
  styleUrls: ["./scan-record.page.scss"],
  standalone: false,
})
export class ScanRecordPage implements OnInit, OnDestroy {
  @ViewChild("scannerFrame", { static: true }) scannerFrame!: ElementRef<HTMLDivElement>;

  torchOn = false;
  recording = false;
  recState: RecState = "idle";
  ready = false;

  currentCode: string | null = null;
  lastCodeAt = 0;
  debounceMs = 600;
  allowSameCodeAfterMs = 4000;

  duration = 0; // giây
  durationTimeFormat = "00:00:00";
  private timerId: any;

  lastError = "";
  infoText = "Đang khởi tạo camera...";

  // Voices
  successVoice = "/assets/sounds/success.mp3";
  newOrderVoice = "/assets/sounds/start.mp3";
  savingOrderVoice = "/assets/sounds/saving.mp3";
  detectNewOrderVoice = "/assets/sounds/detect-new-order.mp3";

  private savingInProgress = false;

  // Chống start/stop lặp
  private barcodeBusy = false;
  private barcodeCooldownUntil = 0;

  // --- Auto save khi mất mã hiện tại ---
  private readonly INACTIVITY_MS = 5000; // 5 giây
  private lastSeenCurrentAt = 0;
  private inactivityTimerId: any = null;
  private autoSaveBusy = false;

  // Cờ bật/tắt tính năng auto-save 5s
  autoSaveEnabled = false;

  // Metadata video hiện tại
  video: VideoMeta | null = null;

  constructor(
    private platform: Platform,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private sound: SoundService,
    private loading: LoadingService,
    private credential: CredentialService,
    private deviceInfo: DeviceInfoService,
    private packService: PackService,
    private toastCtl: ToastController,
    private alertCtl: AlertController,
  ) {}

  ngOnInit(): void {
    // Khôi phục cấu hình autoSave từ localStorage
    try {
      const saved = localStorage.getItem("autoSaveEnabled");
      if (saved !== null) this.autoSaveEnabled = saved === "1";
    } catch {}
  }

  async ngOnDestroy(): Promise<void> {
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
    this.stopInactivityWatch();
    document.body.classList.remove("camera-preview-active", "qrscanner");
    this.stopCounter();
  }

  async ionViewWillLeave() {
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
    this.stopInactivityWatch();
    document.body.classList.remove("qrscanner", "camera-preview-active");
    this.stopCounter();
    this.recording = false;
    this.recState = "idle";
  }

  async ionViewWillEnter() {
    if (!ENV.isWebApp && (this.platform.is("ios") || this.platform.is("android"))) {
      await this.startInlinePreview();
    }
  }

  // =================== PREVIEW ===================
  async startInlinePreview() {
    setTimeout(() => document.body.classList.add("camera-preview-active"), 300);
    this.infoText = "Đang mở camera...";

    await CameraBarcode.removeAllListeners().catch(() => {}); // tránh nhân listener
    await CameraBarcode.startPreview({ toBack: true, withAudio: false });
    this.recState = "previewing";
    this.infoText = "Sẵn sàng quét mã";

    await this.attachBarcodeListener();
  }

  private async attachBarcodeListener() {
    await CameraBarcode.addListener("barcode", async (e) => {
      const code = e?.value?.toString?.().trim?.() ?? e?.value;
      const now = (e as any)?.ts ?? Date.now();
      await this.handleBarcodeEvent(code, now);
    });
  }

  private async handleBarcodeEvent(code: string | null, now: number) {
    if (!code) return;

    // nếu vẫn là mã hiện tại và cờ bật → cập nhật last seen để tránh autosave
    if (this.autoSaveEnabled && code === this.currentCode) {
      this.lastSeenCurrentAt = now;
    }

    // Chặn khi đang xử lý/đang chuyển trạng thái/đang cooldown
    if (this.barcodeBusy) return;
    if (now < this.barcodeCooldownUntil) return;
    if (this.recState === "starting" || this.recState === "stopping") return;

    // Debounce
    if (code === this.currentCode && now - this.lastCodeAt < this.allowSameCodeAfterMs) return;
    if (now - this.lastCodeAt < this.debounceMs) return;

    this.lastCodeAt = now;

    try {
      this.barcodeBusy = true;

      if (!this.recording) {
        // LẦN ĐẦU: phát start (song song) → bắt đầu quay theo mã
        this.loading.loadingOn();
        const voiceP = this.safePlay(this.newOrderVoice); // fire-and-forget
        await this.startRecordingForCode(code);
        await voiceP.catch(() => {});
        this.loading.loadingOff();
        this.barcodeCooldownUntil = now + 1000;
        return;
      }

      if (this.currentCode !== code) {
        // ĐANG QUAY & GẶP MÃ MỚI → LƯU ĐƠN HÀNG HIỆN TẠI RỒI BẮT ĐẦU ĐƠN MỚI
        await this.saveCurrentOrderAndStartNext(code, now);
      }
    } catch {
      this.loading.loadingOff();
      this.toast("Có lỗi trong quá trình ghi/lưu video");
    } finally {
      this.barcodeBusy = false;
    }
  }

  private async saveCurrentOrderAndStartNext(nextCode: string | null, now = Date.now()) {
    if (this.recState !== "recording") return;

    this.loading.loadingOn();
    this.stopCounter();

    // 1) Phát "new order" NGAY và KHÔNG chờ (song song với các thao tác khác)
    this.safePlay(this.newOrderVoice).catch(() => {});

    // 2) Dừng clip hiện tại để lấy file (bắt buộc phải await)
    const savedUri = await this.stopRecordingAndGetPath();

    // 3) Bắt đầu SAVE ở HẬU CẢNH (không chờ) + voice "saving" → "success"
    (async () => {
      this.savingInProgress = true;
      try {
        await this.persistPack(savedUri).catch(() => {});
      } finally {
        this.savingInProgress = false;
      }
    })().catch(() => {});

    // 4) (tuỳ chọn) nghỉ rất ngắn cho encoder nhả resource rồi QUAY LẠI NGAY với mã mới
    await this.sleep(120);
    if (nextCode) {
      await this.startRecordingForCode(nextCode);
      this.barcodeCooldownUntil = now + 1000;
    }

    this.loading.loadingOff();
  }

  // =================== RECORD HELPERS ===================
  private async startRecordingForCode(code: string) {
    if (this.recState === "stopping") {
      for (let i = 0; i < 8 && this.recState === "stopping"; i++) await this.sleep(80);
    }
    if (this.recState === "idle") {
      await this.startInlinePreview();
    }

    // Đặt cờ TRƯỚC khi await để chặn event lặp
    this.recState = "starting";
    this.recording = true;
    this.currentCode = code;

    // Khởi tạo metadata video NGAY LÚC BẮT ĐẦU QUAY
    this.video = {
      orderCode: code,
      startRecordDate: new Date(), // ✅ set ngay khi chuẩn bị quay
      videoMimeType: "video/mp4",
      videoFileName: `${code}.mp4`,
    };
    // reset/khởi động watchdog 5s (chỉ khi cờ bật)
    this.lastSeenCurrentAt = Date.now();
    if (this.autoSaveEnabled) this.startInactivityWatch();

    this.resetCounter(); // reset timer theo clip mới

    try {
      const { recordingId } = await CameraBarcode.startRecording({
        fileNamePrefix: code,
        quality: "sd",
      });
      // console.log('recordingId', recordingId);
      this.startCounter();
      this.recState = "recording";
    } catch (e) {
      // rollback
      this.recording = false;
      this.currentCode = null;
      this.recState = "previewing";
      this.video = null;
      this.stopInactivityWatch();
      throw e;
    }
  }

  private async stopRecordingAndGetPath(): Promise<string | undefined> {
    if (!this.recording || this.recState !== "recording") return;
    this.recState = "stopping";
    this.stopInactivityWatch();
    try {
      const stopAt = new Date();
      const { uri } = await CameraBarcode.stopRecording();

      if (this.video) {
        this.video.endRecordDate = stopAt;
        const start = this.video.startRecordDate ?? stopAt;
        this.video.timeRecordedMs = Math.max(0, stopAt.getTime() - start.getTime());
        this.video.videoUri = uri || undefined;
        if (uri) {
          this.video.videoFileSize = await this.getFileSizeBytes(uri);
        }
      }

      this.recording = false;
      this.recState = "previewing";
      return uri || undefined;
    } catch {
      this.recording = false;
      this.recState = "previewing";
      return undefined;
    }
  }

  // =================== ACTION BUTTONS ===================
  async saveVideoManually() {
    if (this.savingInProgress) return;
    this.savingInProgress = true;
    this.loading.loadingOn();
    try {
      if (this.recState === "recording") {
        this.stopCounter();
        const savedUri = await this.stopRecordingAndGetPath();
        await this.persistPack(savedUri).catch(() => {});
        await this.safePlay(this.successVoice);
      }
    } finally {
      this.resetCounter();
      this.loading.loadingOff();
      this.savingInProgress = false;
    }
  }

  async toggleTorch() {
    try {
      this.torchOn = !this.torchOn;
      await CameraBarcode.setTorch(this.torchOn); // plugin: boolean
    } catch {}
  }

  // Cho phép bật/tắt tính năng autosave 5s và lưu vào localStorage
  setAutoSaveEnabled(v: boolean) {
    this.autoSaveEnabled = v;
    try {
      localStorage.setItem("autoSaveEnabled", v ? "1" : "0");
    } catch {}

    if (!v) {
      // Tắt watchdog ngay nếu đang bật
      this.stopInactivityWatch();
    } else {
      // Bật watchdog ngay nếu đang quay
      if (this.recState === "recording") {
        this.lastSeenCurrentAt = Date.now();
        this.startInactivityWatch();
      }
    }
  }

  // =================== TIMER (đã sửa để UI luôn cập nhật) ===================
  private startCounter(reset = false) {
    if (reset) this.resetCounter();
    this.stopCounter();

    this.zone.runOutsideAngular(() => {
      this.timerId = setInterval(() => {
        this.zone.run(() => {
          this.duration++;
          this.durationTimeFormat = this.formatDuration(this.duration);
          this.cdr.markForCheck();
        });
      }, 1000);
    });
  }

  private resetCounter() {
    this.stopCounter();
    this.duration = 0;
    this.durationTimeFormat = this.formatDuration(this.duration);
    this.cdr.markForCheck();
  }

  private stopCounter() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private formatDuration(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }
  private pad(v: number) {
    return v < 10 ? `0${v}` : `${v}`;
  }

  // =================== INACTIVITY WATCH (5s không thấy mã -> auto save) ===================
  private startInactivityWatch() {
    if (!this.autoSaveEnabled) return; // cờ tắt thì không bật timer
    this.stopInactivityWatch();
    this.zone.runOutsideAngular(() => {
      this.inactivityTimerId = setInterval(async () => {
        if (this.recState !== "recording" || !this.currentCode) return;
        if (this.autoSaveBusy || this.savingInProgress) return;

        const now = Date.now();
        if (now - this.lastSeenCurrentAt >= this.INACTIVITY_MS) {
          this.autoSaveBusy = true;
          this.barcodeBusy = true; // khoá event barcode trong lúc autosave
          try {
            await this.autoSaveCurrentOrder();
            this.barcodeCooldownUntil = Date.now() + 1000;
          } finally {
            this.barcodeBusy = false;
            this.autoSaveBusy = false;
          }
        }
      }, 1000);
    });
  }

  private stopInactivityWatch() {
    if (this.inactivityTimerId) {
      clearInterval(this.inactivityTimerId);
      this.inactivityTimerId = null;
    }
  }

  /** Lưu đơn hàng hiện tại, không bắt đầu quay lại (giống save manually) */
  private async autoSaveCurrentOrder() {
    if (this.recState !== "recording") return;

    this.loading.loadingOn();
    this.stopCounter();

    try {
      await this.safePlay(this.savingOrderVoice);
      const savedUri = await this.stopRecordingAndGetPath(); // đã stop & cập nhật this.video
      await this.persistPack(savedUri).catch(() => {});
      await this.safePlay(this.successVoice);
    } finally {
      this.resetCounter();
      this.loading.loadingOff();
    }
  }

  // =================== PACK PERSIST ===================
  private async persistPack(savedUri?: string) {
    try {
      const currentUser: any = await this.credential.getCurrentUser();
      const userId = currentUser?._id;
      const dev = await this.deviceInfo.getDeviceInfo();

      const v = this.video ?? { orderCode: this.currentCode ?? null };
      const uri = savedUri ?? v.videoUri;

      let size = v.videoFileSize;
      if (!size && uri) {
        size = await this.getFileSizeBytes(uri);
      }

      const payload = {
        userId,
        deviceId: dev.deviceId,
        packNumber: v.orderCode || this.currentCode || "UNKNOWN",
        orderCode: v.orderCode || this.currentCode || undefined,
        createDate: new Date().toISOString(),
        startRecordDate: v.startRecordDate ? v.startRecordDate.toISOString() : "", // ✅ set ngay khi bắt đầu
        endRecordDate: v.endRecordDate ? v.endRecordDate.toISOString() : new Date().toISOString(),
        timeRecordedMs: typeof v.timeRecordedMs === "number" ? v.timeRecordedMs : this.duration * 1000,
        status: "recorded" as const,
        videoStorage: uri ? ("local" as const) : undefined,
        videoStorageKey: uri,
        videoFileName: v.videoFileName ?? (v.orderCode ? `${v.orderCode}.mp4` : undefined),
        videoFileSize: size,
        videoMimeType: v.videoMimeType ?? "video/mp4",
        appVersion: dev.appVersion,
        notes: undefined,
      };

      this.packService.create(payload).subscribe(() => {});
    } catch {}
  }

  private async getFileSizeBytes(path: string): Promise<number | undefined> {
    try {
      const info: any = await Filesystem.stat({ path });
      if (typeof info?.size === "number" && !isNaN(info.size)) return info.size;
    } catch {}

    try {
      const url = Capacitor.convertFileSrc(path);
      const res = await fetch(url);
      const blob = await res.blob();
      return blob.size;
    } catch {}

    return undefined;
  }

  // =================== UTILS ===================
  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
  private async safePlay(src: string) {
    try {
      await this.sound.playAndWait(src);
    } catch {}
  }
  private async toast(message: string) {
    const t = await this.toastCtl.create({ message, duration: 1800, position: "bottom" });
    await t.present();
  }
}
