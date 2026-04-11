import { Component, ElementRef, OnDestroy, OnInit, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { Platform, ToastController } from "@ionic/angular";
import { Router } from "@angular/router";
import { Capacitor } from "@capacitor/core";

import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
import { LoadingService } from "@rsApp/shared/services/loadding-service/loading.service";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { StatisticsService } from "@rsApp/shared/services/statistics/statistics.service";
import { AdmobService } from "@rsApp/shared/services/admob-service/dmob.service";

import { CameraBarcode } from "../../../plugin/CameraXScanner";
import { Filesystem } from "@capacitor/filesystem";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ENV } from "@app/env";

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
  // Cờ bật/tắt hiện ngày giờ trên preview & video
  timestampEnabled = true;
  // Cờ bật/tắt ghi âm
  audioEnabled = false;

  // Return video tracking
  recordMode?: "normal" | "return"; // 'normal' for regular recording, 'return' for return video
  returnOrderId?: string; // Order code passed from pack-detail for return video

  // Metadata video hiện tại
  video: VideoMeta | null = null;

  constructor(
    private platform: Platform,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sound: SoundService,
    private loading: LoadingService,
    private deviceInfo: DeviceInfoService,
    private packService: PackService,
    private toastCtl: ToastController,
    private statisticsService: StatisticsService,
    private ads: AdmobService,
  ) {}

  ngOnInit(): void {
    // Khôi phục cấu hình autoSave từ localStorage
    try {
      const saved = localStorage.getItem("autoSaveEnabled");
      if (saved !== null) this.autoSaveEnabled = saved === "1";
    } catch {}

    // Check for return video mode and order code
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      const state = navigation.extras.state;
      if (state["recordMode"] === "return") {
        this.recordMode = "return";
        this.returnOrderId = state["orderCode"];
        console.log(`🎥 [ScanRecord] Return video mode enabled for order: ${this.returnOrderId}`);
      }
    }
  }

  async ngOnDestroy(): Promise<void> {
    // Cho phép màn hình tắt khi destroy page
    try {
      await KeepAwake.allowSleep();
      console.log("Keep awake deactivated");
    } catch (error) {
      console.warn("Failed to deactivate keep awake:", error);
    }

    // Hide timestamp overlay when page is destroyed
    try {
      await CameraBarcode.setTimestampOverlay({ enabled: false });
    } catch {}
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
    this.stopInactivityWatch();
    this.stopCounter();

    // Cleanup all states
    this.recording = false;
    this.recState = "idle";
    this.barcodeBusy = false;
    this.barcodeCooldownUntil = 0;
    this.currentCode = null;
    this.video = null;

    document.body.classList.remove("camera-preview-active", "qrscanner");
  }

  async ionViewWillLeave() {
    // Cho phép màn hình tắt khi rời khỏi page
    try {
      await KeepAwake.allowSleep();
      console.log("Keep awake deactivated");
    } catch (error) {
      console.warn("Failed to deactivate keep awake:", error);
    }

    // Hide timestamp overlay when navigating away
    try {
      await CameraBarcode.setTimestampOverlay({ enabled: false });
    } catch {}
    await CameraBarcode.removeAllListeners().catch(() => {});
    try {
      if (this.recState === "recording") await CameraBarcode.stopRecording();
    } catch {}
    this.stopInactivityWatch();
    this.stopCounter();

    // Cleanup all states when leaving page
    this.recording = false;
    this.recState = "idle";
    this.barcodeBusy = false;
    this.barcodeCooldownUntil = 0;
    this.currentCode = null;
    this.video = null;

    document.body.classList.remove("qrscanner", "camera-preview-active");

    // Kiểm tra và hiển thị quảng cáo nếu chưa đủ số lần trong ngày
    await this.ads.checkAndShowRewardAd();
  }

  async ionViewWillEnter() {
    // Giữ màn hình sáng khi vào trang scan
    if (this.platform.is("ios") || this.platform.is("android")) {
      try {
        await KeepAwake.keepAwake();
        console.log("Keep awake activated");
      } catch (error) {
        console.warn("Failed to activate keep awake:", error);
      }
      await this.startInlinePreview();
    }
  }

  // =================== PREVIEW ===================
  async startInlinePreview() {
    try {
      this.infoText = "Đang mở camera...";

      // Start camera - plugin will automatically request permissions if needed
      await CameraBarcode.removeAllListeners().catch(() => {});
      await CameraBarcode.startPreview({ toBack: true, withAudio: false });

      // Success! Camera is accessible
      await this.onCameraStartSuccess();
    } catch (error) {
      console.error("❌ [ScanRecord] Error in startInlinePreview:", error);
      this.infoText = "❌ Không thể mở camera";
    }
  }

  /**
   * Called when camera preview started successfully
   */
  private async onCameraStartSuccess() {
    setTimeout(() => document.body.classList.add("camera-preview-active"), 300);
    this.recState = "previewing";
    this.infoText = "Sẵn sàng quét mã";

    // Bật/tắt timestamp theo cờ người dùng cho phần preview
    try {
      await CameraBarcode.setTimestampOverlay({
        enabled: this.timestampEnabled,
        format: "yyyy-MM-dd HH:mm:ss",
        textSizeSp: 18,
        color: "#FFFFFFFF",
        marginDp: 12,
      });
    } catch {}

    // Test torch capabilities khi camera đã sẵn sàng
    await this.checkTorchCapabilities();

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
    // Disable barcode scanning in return video mode - use manual button instead
    if (this.recordMode === "return") {
      console.log(`📦 [ScanRecord] Return video mode - barcode scan disabled, use manual button`);
      return;
    }

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

    // 3) SNAPSHOT video cũ TRƯỚC KHI bắt đầu video mới (tránh race condition)
    const oldVideo = this.video ? { ...this.video } : null;

    // 4) Bắt đầu SAVE ở HẬU CẢNH (không chờ) + voice "saving" → "success"
    (async () => {
      this.savingInProgress = true;
      try {
        await this.persistPack(savedUri, oldVideo).catch(() => {});
      } finally {
        this.savingInProgress = false;
      }
    })().catch(() => {});

    // 5) (tuỳ chọn) nghỉ rất ngắn cho encoder nhả resource rồi QUAY LẠI NGAY với mã mới
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
      // Áp dụng cờ timestamp cho cả phần ghi hình (burn-in), bật trước khi startRecording
      await CameraBarcode.setTimestampOverlay({
        enabled: this.timestampEnabled,
        format: "yyyy-MM-dd HH:mm:ss",
        textSizeSp: 18,
        color: "#FFFFFFFF",
        marginDp: 12,
      });

      // Try preferred quality first; fall back gracefully if device doesn't support it
      let recordingId: string | undefined;
      try {
        ({ recordingId } = await CameraBarcode.startRecording({
          fileNamePrefix: code,
          quality: "hd", // prefer hd for better 16:9; plugin will also try to fallback
          isReturn: this.recordMode === "return", // truyền cờ return để plugin áp dụng cấu hình tối ưu cho return video
        } as any));
      } catch {}
      console.log("recordingId", recordingId);
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
        const videoSnapshot = this.video ? { ...this.video } : null;
        await this.persistPack(savedUri, videoSnapshot).catch(() => {});
        await this.safePlay(this.successVoice);
      }
    } finally {
      this.resetCounter();
      this.loading.loadingOff();
      this.savingInProgress = false;
    }
  }

  /** Manual start recording for return video mode */
  async startReturnVideoRecording() {
    if (!this.returnOrderId) {
      await this.toast("❌ Không có OrderCode từ pack");
      return;
    }

    if (this.recording) {
      await this.toast("⚠️ Đang quay video, vui lòng dừng trước");
      return;
    }

    try {
      this.loading.loadingOn();
      console.log(`🎥 [ScanRecord] Starting manual return video for order: ${this.returnOrderId}`);

      // Start recording with the orderCode from pack-detail
      await this.startRecordingForCode(this.returnOrderId);

      await this.safePlay(this.newOrderVoice);
      this.loading.loadingOff();
    } catch (error) {
      console.error("❌ [ScanRecord] Failed to start return video:", error);
      await this.toast("❌ Lỗi khi bắt đầu quay");
      this.loading.loadingOff();
    }
  }

  async toggleTorch() {
    try {
      console.log("Current torch state:", this.torchOn);
      console.log("Current recording state:", this.recState);

      // Kiểm tra xem có đang ở trạng thái có thể sử dụng torch không
      if (this.recState === "idle") {
        return;
      }

      // Kiểm tra platform
      if (!this.platform.is("ios") && !this.platform.is("android")) {
        return;
      }

      const newTorchState = !this.torchOn;
      console.log("Setting torch to:", newTorchState);

      // Thử set torch với timeout
      const torchPromise = CameraBarcode.setTorchState(newTorchState);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Torch operation timeout")), 5000));

      await Promise.race([torchPromise, timeoutPromise]);
      // Chỉ cập nhật state khi API call thành công
      this.torchOn = newTorchState;
      // Feedback cho user
    } catch (error) {
      // Reset torch state về false nếu có lỗi
      this.torchOn = false;

      let errorMessage = "Không thể bật/tắt đèn pin";
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          errorMessage = "Đèn pin không phản hồi. Vui lòng thử lại";
        } else if (error.message.includes("not available")) {
          errorMessage = "Thiết bị không hỗ trợ đèn pin";
        }
      }

      await this.toast(errorMessage);
    }
  }

  // Bật/tắt ghi âm và áp dụng ngay cho lần quay tiếp theo
  async setAudioEnabled(v: boolean) {
    this.audioEnabled = v;
    try {
      localStorage.setItem("audioEnabled", v ? "1" : "0");
    } catch {}
    // Thông báo xuống native để nó cập nhật controller.withAudio cho lần ghi tiếp theo
    try {
      await CameraBarcode.setAudioEnabled(v);
    } catch {}
  }

  // Bật/tắt timestamp và lưu cấu hình
  async setTimestampEnabled(v: boolean) {
    this.timestampEnabled = v;
    try {
      localStorage.setItem("timestampEnabled", v ? "1" : "0");
    } catch {}
    // Áp dụng ngay nếu đang ở trạng thái preview
    if (this.recState === "previewing" || this.recState === "idle") {
      try {
        await CameraBarcode.setTimestampOverlay({
          enabled: this.timestampEnabled,
          format: "yyyy-MM-dd HH:mm:ss",
          textSizeSp: 18,
          color: "#FFFFFFFF",
          marginDp: 12,
        });
      } catch {}
    }
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
      const videoSnapshot = this.video ? { ...this.video } : null;
      await this.persistPack(savedUri, videoSnapshot).catch(() => {});
      await this.safePlay(this.successVoice);
    } finally {
      this.resetCounter();
      this.loading.loadingOff();
    }
  }

  // =================== PACK PERSIST ===================
  private async persistPack(savedUri?: string, videoData?: VideoMeta | null) {
    try {
      const dev = await this.deviceInfo.getDeviceInfo();

      const v = videoData ?? this.video ?? { orderCode: this.currentCode ?? null };
      const uri = savedUri ?? v.videoUri;

      let size = v.videoFileSize;
      if (!size && uri) {
        size = await this.getFileSizeBytes(uri);
      }

      // Generate thumbnail from video
      let thumbnailBase64: string | undefined;
      if (uri) {
        thumbnailBase64 = await this.generateThumbnail(uri);
      }

      // Generate incrementing _id with UUID prefix
      const timestamp = Date.now();
      const uniqueId = Math.floor(Math.random() * 10000);
      const incrementingId = `${timestamp}-${uniqueId}`;

      const payload = {
        _id: incrementingId,
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
        thumbnailStorage: thumbnailBase64 ? ("local" as const) : undefined,
        thumbnailBase64: thumbnailBase64,
        videoType: this.recordMode === "return" ? ("return" as const) : ("normal" as const),
        appVersion: dev.appVersion,
        notes: undefined,
      };

      // Use separate storage for return videos
      const createMethod = this.recordMode === "return" ? this.packService.createPackReturn(payload) : this.packService.create(payload);

      createMethod.subscribe({
        next: (result) => {
          if (result && result._id) {
            this.statisticsService.incrementVideosRecorded();
            console.log(`✅ [ScanRecord] Video saved: ${result._id}, type: ${result.videoType}`);

            // Navigate back to pack-detail for return videos
            if (this.recordMode === "return") {
              console.log(`📦 [ScanRecord] Return video saved, navigating back to pack-detail`);
              setTimeout(() => {
                this.router.navigate(["/tabs/home"]); // Go back to home/packs list
              }, 1500);
            }
          } else {
            // API trả về nhưng không thành công, cache video
          }
        },
        error: (error) => {
          console.error("API save failed, caching video:", error);
          // Cache video khi API call fail
          // Vẫn tăng counter vì video đã được quay
          this.statisticsService.incrementVideosRecorded();
          // Cache video khi API call fail
        },
      });
    } catch (error) {
      console.error("Failed to persist pack:", error);
    }
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

  /**
   * Generate thumbnail from video file as base64
   */
  private async generateThumbnail(videoPath: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      try {
        // Convert local path to web-accessible URL
        const videoUrl = Capacitor.convertFileSrc(videoPath);

        // Create video element
        const video = document.createElement("video");
        video.src = videoUrl;
        video.crossOrigin = "anonymous";

        // Seek to first frame then capture
        const onLoadedMetadata = () => {
          try {
            video.currentTime = 0;
          } catch (e) {
            video.currentTime = 0.5; // fallback to 0.5s if seek fails
          }
        };

        const onSeeked = () => {
          try {
            // Create canvas and capture frame - scaled down for thumbnail
            const canvas = document.createElement("canvas");
            const videoWidth = video.videoWidth || 1280;
            const videoHeight = video.videoHeight || 720;

            // Scale to smaller thumbnail (160x90)
            const thumbWidth = 160;
            const thumbHeight = Math.round((videoHeight / videoWidth) * thumbWidth);

            canvas.width = thumbWidth;
            canvas.height = thumbHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              cleanup();
              resolve(undefined);
              return;
            }

            ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);

            // Convert to base64 with lower quality and compress
            let base64 = canvas.toDataURL("image/jpeg", 0.5); // 50% quality for smaller size

            // If base64 is too large (>50KB), don't send it
            // Rough estimate: 1 char ≈ 0.75 bytes, so 50KB ≈ 66k chars
            if (base64.length > 66000) {
              console.warn("Thumbnail too large, skipping:", base64.length, "chars");
              cleanup();
              resolve(undefined);
              return;
            }

            // Remove "data:image/jpeg;base64," prefix for storage
            base64 = base64.replace(/^data:image\/jpeg;base64,/, "");

            cleanup();
            resolve(base64);
          } catch (e) {
            console.error("Error generating thumbnail:", e);
            cleanup();
            resolve(undefined);
          }
        };

        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
          try {
            video.pause();
            video.src = "";
          } catch {}
        };

        const onError = () => {
          console.error("Error loading video for thumbnail");
          cleanup();
          resolve(undefined);
        };

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);

        // Start loading
        video.load();

        // Timeout: if can't generate thumbnail in 5s, give up
        setTimeout(() => {
          cleanup();
          resolve(undefined);
        }, 5000);
      } catch (e) {
        console.error("Failed to generate thumbnail:", e);
        resolve(undefined);
      }
    });
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

  /**
   * Kiểm tra khả năng sử dụng torch của thiết bị
   */
  private async checkTorchCapabilities() {
    try {
      console.log("Testing torch capabilities...");

      // Thử bật torch một cách im lặng để test
      await CameraBarcode.setTorchState(false);
      console.log("Torch capabilities: OK");
    } catch (error) {
      console.warn("Torch not available on this device:", error);

      // Disable torch button hoặc thông báo user
      // this.torchSupported = false; // có thể thêm flag này vào component
    }
  }
}
