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

  ngOnInit(): void {}

  async ngOnDestroy(): Promise<void> {
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
    document.body.classList.remove("camera-preview-active", "qrscanner");
    this.stopCounter();
  }

  async ionViewWillLeave() {
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
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
        // LẦN ĐẦU: phát start → bắt đầu quay theo mã
        this.loading.loadingOn();

        // Phát voice song song, KHÔNG await ngay
        const voiceP = this.safePlay(this.newOrderVoice);

        // Bắt đầu quay (đang hiển thị loading)
        await this.startRecordingForCode(code);

        // (tuỳ chọn) chờ voice hoàn tất, nhưng không để chặn flow
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
    // Nếu không có clip đang quay thì bỏ
    if (this.recState !== "recording") return;

    this.loading.loadingOn();
    this.stopCounter();

    // Voice giống trang cũ
    await this.safePlay(this.detectNewOrderVoice);
    await this.safePlay(this.savingOrderVoice);

    // Dừng & lấy file, cập nhật metadata (endRecordDate/timeRecordedMs)
    const savedUri = await this.stopRecordingAndGetPath();

    // Gửi API
    await this.persistPack(savedUri).catch(() => {});

    // Voice thành công
    await this.safePlay(this.successVoice);

    // Cho encoder nhả tài nguyên
    await this.sleep(350);

    // Nếu có mã tiếp theo → bắt đầu quay mã mới
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
      startRecordDate: new Date(), // ✅ start ngay khi chuẩn bị quay
      videoMimeType: "video/mp4",
      videoFileName: `${code}.mp4`,
    };
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
      throw e;
    }
  }

  private async stopRecordingAndGetPath(): Promise<string | undefined> {
    if (!this.recording || this.recState !== "recording") return;
    this.recState = "stopping";
    try {
      const stopAt = new Date();
      const { uri } = await CameraBarcode.stopRecording();

      // cập nhật metadata video
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
        await this.safePlay(this.savingOrderVoice);
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

  // =================== TIMER (đã sửa để UI luôn cập nhật) ===================
  private startCounter(reset = false) {
    if (reset) this.resetCounter();
    this.stopCounter();

    // Chạy ngoài Angular để mượt hơn
    this.zone.runOutsideAngular(() => {
      this.timerId = setInterval(() => {
        // Quay lại Angular để cập nhật UI
        this.zone.run(() => {
          this.duration++;
          this.durationTimeFormat = this.formatDuration(this.duration);
          this.cdr.markForCheck(); // ép change detection (đặc biệt khi dùng OnPush hay tác vụ native)
        });
      }, 1000);
    });
  }

  private resetCounter() {
    this.stopCounter();
    // Đảm bảo cập nhật ngay lập tức ra UI
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
