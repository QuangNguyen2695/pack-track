import { Component, NgZone, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from "@angular/core";
import { Platform } from "@ionic/angular";
import { ENV } from "src/environments/environment.development";
import { Subject, debounceTime } from "rxjs";

import { Camera } from "@capacitor/camera";
import { Media } from "@capacitor-community/media";

import { VideoModel } from "../video/model/video.model";
import { VideoService } from "../video/service/video.service";

import { CameraPreviewOptions } from "@capacitor-community/camera-preview";
import { Result } from "@zxing/library";

import { CameraPreviewService } from "./services/camera-preview.service";
import { BarcodeScannerService } from "./services/barcode-scanner.service";
import { MediaSaveService } from "./services/media-save.service";
import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
import { LoadingService } from "@rsApp/shared/services/loadding-service/loading.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { Filesystem } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

type RecState = "idle" | "previewing" | "starting" | "recording" | "stopping";

@Component({
  selector: "app-scan",
  templateUrl: "scan.page.html",
  styleUrls: ["scan.page.scss"],
  standalone: false,
})
export class ScanPage implements OnInit, AfterViewInit {
  @ViewChild("scannerFrame", { static: true }) scannerFrame!: ElementRef;

  // UI state
  isLoaded = false;
  torchEnabled = false;
  cornerPoints: number[][] = [];
  cornerPoints$ = new Subject<number[][]>();
  containerWidth = 0;
  containerHeight = 0;

  // Video meta
  video: VideoModel = new VideoModel("", "", "", new Date(), new Date(), 0, "pending");

  // Timer
  duration = 0;
  durationTimeFormat = "00:00:00";
  private intervalId: any;

  // Record state
  recording = false;
  private recState: RecState = "idle";
  private savingInProgress = false;

  // Sounds
  successVoice = "/assets/sounds/success.mp3";
  newOrderVoice = "/assets/sounds/start.mp3";
  savingOrderVoice = "/assets/sounds/saving.mp3";
  detectNewOrderVoice = "/assets/sounds/detect-new-order.mp3";
  errorVoice = "/assets/sounds/error.mp3";

  // Scan loop
  private scanLoopTimer: any = null;
  private lastCode: string | null = null;
  private lastDetectionAt = 0;
  private scanningPaused = false;
  private seenCodes = new Set<string>();
  private frameCount = 0;
  private isTransitioning = false;

  // Serial queue
  private serialQueue: Promise<void> = Promise.resolve();

  private tempRecording = false; // đang quay tạm?
  private tempRecStartedAt = 0; // thời điểm bắt đầu quay tạm (để xoay vòng)
  private readonly TEMP_ROTATE_MS = 30_000; // (khuyến nghị) đảo file tạm mỗi 30s tránh file quá lớn

  constructor(
    private platform: Platform,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private videoService: VideoService,
    private soundService: SoundService,
    private cam: CameraPreviewService,
    private scanner: BarcodeScannerService,
    private mediaSaver: MediaSaveService,
    private loadingService: LoadingService,
    private deviceInfo: DeviceInfoService,
    private packService: PackService,
    private credentialService: CredentialService,
  ) {}

  async ngOnInit() {
    this.cornerPoints$.pipe(debounceTime(0)).subscribe((points) => {
      this.ngZone.run(() => (this.cornerPoints = points));
    });
  }

  ngAfterViewInit() {
    if (!this.scannerFrame) return;
    setTimeout(() => {
      const rect = this.scannerFrame.nativeElement.getBoundingClientRect();
      this.containerWidth = rect.width;
      this.containerHeight = rect.height;
    }, 500);
  }

  async ionViewWillEnter() {
    if (!ENV.isWebApp && (this.platform.is("ios") || this.platform.is("android"))) {
      await this.requestCameraPermission();
      await this.startInlinePreview();
      this.startScanLoop();
    }
  }

  async ionViewWillLeave() {
    this.stopScanLoop();

    // ⭐ NEW: tắt quay tạm nếu đang bật
    await this.stopTempRecording().catch(() => {});
    await this.cam.stop();
    this.stopCounter();
    this.recording = false;
    document.body.classList.remove("camera-preview-active");
    this.recState = "idle";
  }

  private async requestCameraPermission() {
    try {
      // const perms = await CameraPreview.checkPermissions();
      // if (perms.camera !== "granted") {
      //   await CameraPreview.requestPermissions(); // xin đúng plugin
      // }
      // Nếu bạn thực sự cần thu âm khi quay VIDEO (không khuyến nghị cho 15):
      // if (perms.microphone !== 'granted') await CameraPreview.requestPermissions();
    } catch {}
  }

  // ====== Scan loop (fast + robust xen kẽ) ======
  private startScanLoop(intervalMs = 450) {
    this.stopScanLoop();
    this.scanLoopTimer = setInterval(async () => {
      if (this.scanningPaused || this.recState === "stopping" || this.recState === "starting") return;
      try {
        // ⭐ NEW: nếu đang quay thật hoặc quay tạm → dùng file-based frame
        const useFileFrames = this.recState === "recording" || this.tempRecording;

        // (tuỳ chọn) xoay vòng file quay tạm để tránh phình to
        if (useFileFrames && this.recState !== "recording") {
          await this.maybeRotateTempRecording().catch(() => {});
        }

        const samples: string[] = [];
        const loopCount = useFileFrames ? 2 : 3;

        for (let i = 0; i < loopCount; i++) {
          if (i) await this.sleep(useFileFrames ? 60 : 40);

          let dataUrl: string | null = null;

          if (useFileFrames) {
            // 🟢 giống nhánh recording cũ
            const filePath = await this.cam.captureToFile(82);
            if (filePath) {
              const base64 = await this.cam.pathToBase64Any(filePath);
              await this.cam.deleteFile(filePath);
              if (base64) dataUrl = `data:image/jpeg;base64,${base64}`;
            }
          } else {
            // 🔵 fallback khi không quay tạm
            const base64 = await this.cam.captureSampleBase64(88);
            if (base64) dataUrl = `data:image/jpeg;base64,${base64}`;
          }

          if (dataUrl) samples.push(dataUrl);
        }
        if (!samples.length) return;

        const scored = await Promise.all(samples.map(async (d) => [await this.cam.sharpnessScore(d), d] as [number, string]));
        scored.sort((a, b) => b[0] - a[0]);
        const bestDataUrl = scored[0][1];
        if (!bestDataUrl) return;

        const luma = await this.cam.avgLuma(bestDataUrl);
        if (luma < 40 && !this.torchEnabled) {
          try {
            await this.toggleTorch();
          } catch {}
        }

        this.frameCount = (this.frameCount + 1) % 3;
        const result: Result | null =
          this.frameCount === 0 ? await this.scanner.decodeRobust(bestDataUrl) : await this.scanner.decodeFast(bestDataUrl);

        if (!result) return;

        const code = result.getText()?.trim();
        if (!code) return;

        const now = Date.now();
        if (code === this.lastCode && now - this.lastDetectionAt < 600) return;
        this.lastCode = code;
        this.lastDetectionAt = now;

        await this.handleDetectedCode(code);
      } catch {}
    }, intervalMs);
  }

  private stopScanLoop() {
    if (this.scanLoopTimer) {
      clearInterval(this.scanLoopTimer);
      this.scanLoopTimer = null;
    }
  }
  private pauseScanLoop() {
    this.scanningPaused = true;
  }
  private resumeScanLoop() {
    this.scanningPaused = false;
  }

  private async handleDetectedCode(code: string): Promise<void> {
    await this.runSerial(async () => {
      if (!code) return;
      if (this.seenCodes.has(code)) return;
      if (this.isTransitioning) return; // ⬅️ chặn đua
      this.seenCodes.add(code);

      this.isTransitioning = true;
      this.scanningPaused = true; // ⬅️ dừng chụp frame ngay

      try {
        if (this.recState === "recording") {
          this.loadingService.loadingOn();
          this.stopCounter();

          try {
            await this.soundService.playAndWait(this.detectNewOrderVoice);
            await this.soundService.playAndWait(this.savingOrderVoice);
          } catch {}

          // Dừng & lưu clip hiện tại
          const savedPath = await this.stopInlineRecordingAndSave();
          await this.persistPack(savedPath);

          try {
            await this.soundService.playAndWait(this.successVoice);
          } catch {}

          // Cho encoder nhả tài nguyên hoàn toàn (tránh crash khi start lại)
          await this.sleep(350); // 300–500ms tuỳ máy

          this.resetCounter();
        }

        // Bắt đầu đơn mới
        await this.startNewOrder(code);

        // Chờ recorder vào trạng thái "recording" hẳn rồi mới cho scan chạy lại
        for (let i = 0; i < 8 && this.recState !== "recording"; i++) {
          await this.sleep(100);
        }
      } finally {
        this.loadingService.loadingOff();
        this.scanningPaused = false; // cho phép scan lại (vừa quay vừa quét)
        this.isTransitioning = false;
      }
    });
  }

  private async startTempRecording() {
    if (this.tempRecording || this.recState === "recording" || this.recState === "starting") return;
    try {
      await this.cam.startRecord(); // quay tạm (không lưu)
      this.tempRecording = true;
      this.tempRecStartedAt = Date.now();
    } catch (e) {
      this.tempRecording = false;
    }
  }

  private async stopTempRecording() {
    if (!this.tempRecording) return;
    try {
      // Dừng quay tạm nhưng KHÔNG lưu file (bỏ kết quả)
      await this.cam.stopRecord(/* discard: true nếu plugin hỗ trợ, còn không thì: */);
      this.tempRecording = false;
    } catch {
      this.tempRecording = false;
    }
  }

  private async maybeRotateTempRecording() {
    if (!this.tempRecording) return;
    if (Date.now() - this.tempRecStartedAt < this.TEMP_ROTATE_MS) return;
    try {
      await this.cam.stopRecord();
      await this.cam.startRecord();
      this.tempRecStartedAt = Date.now();
    } catch {}
  }

  // ====== Record flow ======
  private async startInlinePreview() {
    const dpr = window.devicePixelRatio || 1;
    const opts: CameraPreviewOptions = {
      position: "rear",
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      toBack: true,
      storeToFile: true, // ⚠️ phải bật để captureToFile hoạt động
      disableAudio: false,
    };
    await this.cam.start(opts);
    await this.cam.trySetContinuousFocus?.();

    // ⭐ NEW: ngay khi vào preview, bật quay tạm để feed file-based frames cho detector
    await this.startTempRecording();

    document.body.classList.add("camera-preview-active");
    this.recState = "previewing";
    this.resumeScanLoop();
  }

  private async startInlineRecording() {
    if (this.recState === "starting" || this.recState === "recording") return;
    if (this.recState === "idle") await this.startInlinePreview();

    this.recState = "starting";
    try {
      await this.sleep(220);
      await this.cam.trySetContinuousFocus?.();

      // ⭐ NEW: nếu đang quay tạm thì dừng trước khi quay thật
      if (this.tempRecording) {
        await this.stopTempRecording();
        await this.sleep(120); // cho encoder “nhả” resource 1 nhịp
      }

      await this.cam.startRecord(); // quay thật

      await this.sleep(260);
      this.recording = true;
      this.recState = "recording";
      this.loadingService.loadingOff();
    } catch (e) {
      this.recording = false;
      this.recState = "previewing";

      // Nếu quay thật fail, cố gắng bật lại quay tạm để detector không “mù”
      if (!this.tempRecording) {
        await this.startTempRecording().catch(() => {});
      }

      this.resumeScanLoop();
      this.loadingService.loadingOff();
    }
  }

  private async stopInlineRecordingAndSave(): Promise<string | undefined> {
    if (this.recState !== "recording") return;
    this.recState = "stopping";
    try {
      const nativePath = await this.cam.stopRecord();
      this.recording = false;
      this.recState = "previewing";
      this.resumeScanLoop();
      if (!nativePath) return;

      const baseName = (this.video?.name || this.video?.orderCode || "video").replace(/[^\w\-]+/g, "_").slice(0, 40);
      const savedPath = await this.mediaSaver.saveVideo(nativePath, baseName, "PackTrack Videos");

      return savedPath;
    } catch (e) {
      this.recording = false;
      this.recState = "previewing";
      this.resumeScanLoop();
      return;
    }
  }

  private async startNewOrder(code: string) {
    this.resetCounter();
    this.video = new VideoModel("", "", "", new Date(), new Date(), 0, "pending");
    this.video.orderCode = code;
    this.video.startTime = new Date();

    try {
      this.loadingService.loadingOn();
      await this.soundService.playAndWait(this.newOrderVoice);
      await this.startInlineRecording();
      this.startCounter();
    } catch {
      this.loadingService.loadingOff();
    }
  }

  async saveVideo() {
    if (this.savingInProgress) return;
    this.loadingService.loadingOn();
    this.stopCounter();
    this.savingInProgress = true;
    try {
      if (this.recState === "starting") {
        for (let i = 0; i < 5 && this.recState === "starting"; i++) await this.sleep(200);
      }
      if (this.recState !== "recording") return;

      this.video.endTime = new Date();
      this.video.name = this.video.orderCode;

      await this.soundService.playAndWait(this.savingOrderVoice);
      const savedPath = await this.stopInlineRecordingAndSave();

      // 👉 LƯU PACK LÊN API
      await this.persistPack(savedPath);

      await this.soundService.playAndWait(this.successVoice);
      this.resumeScanLoop();
      this.loadingService.loadingOff();
    } finally {
      this.resetCounter();
      this.savingInProgress = false;
      this.loadingService.loadingOff();
    }
  }

  async toggleTorch() {
    this.torchEnabled = !this.torchEnabled;
    try {
      await this.cam.setFlashMode(this.torchEnabled ? "torch" : "off");
    } catch {}
  }

  // Utils
  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }

  startCounter() {
    this.stopCounter();
    this.zone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        this.duration++;
        this.durationTimeFormat = this.formattedDuration(this.duration);
        this.zone.run(() => this.cdr.markForCheck());
      }, 1000);
    });
  }
  resetCounter() {
    this.stopCounter();
    this.duration = 0;
    this.durationTimeFormat = this.formattedDuration(this.duration);
  }
  stopCounter() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private formattedDuration(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
  }
  private pad(val: number): string {
    return val < 10 ? "0" + val : val.toString();
  }

  private runSerial(task: () => Promise<void>): Promise<void> {
    this.serialQueue = this.serialQueue.then(task).catch((err) => console.error("[SerialQueue] task error:", err));
    return this.serialQueue;
  }

  getPolygonPoints(): string {
    if (!this.cornerPoints || this.cornerPoints.length !== 4) return "";
    return this.cornerPoints.map((p) => `${p[0]},${p[1]}`).join(" ");
  }

  private async persistPack(savedPath: string | undefined) {
    try {
      const videoPath = savedPath || undefined;
      const currentUser: any = await this.credentialService.getCurrentUser();
      const userId = currentUser?._id;
      const dev = await this.deviceInfo.getDeviceInfo();

      const start = this.video.startTime ?? new Date();
      const end = this.video.endTime ?? new Date();
      const durationMs = Math.max(0, end.getTime() - start.getTime());

      const fileName = this.video?.name ? `${this.video.name}.mp4` : undefined;
      const videoMime = "video/mp4";

      // 👉 lấy size (bytes)
      const videoSize = videoPath ? await this.getFileSizeBytes(videoPath) : undefined;

      const nowIso = new Date().toISOString();

      const payload = {
        userId,
        deviceId: dev.deviceId,
        packNumber: this.video?.orderCode || this.video?.name || "UNKNOWN",
        orderCode: this.video?.orderCode || undefined,
        createDate: nowIso,
        startRecordDate: start.toISOString(),
        endRecordDate: end.toISOString(),
        timeRecordedMs: durationMs,
        status: "recorded" as const,
        videoStorage: videoPath ? ("local" as const) : undefined,
        videoStorageKey: videoPath,
        videoFileName: fileName,
        videoFileSize: videoSize, // 👈 đã có size (bytes)
        videoMimeType: videoMime,
        // videoResolution / videoFrameRate có thể bổ sung sau
        appVersion: dev.appVersion,
        notes: undefined,
      };

      this.packService.create(payload).subscribe(() => {});
    } catch {}
  }

  private async getFileSizeBytes(path: string): Promise<number | undefined> {
    // 1) Thử stat trực tiếp
    try {
      const info: any = await Filesystem.stat({ path });
      // Capacitor v5/v6: info.size là number (bytes)
      if (typeof info?.size === "number" && !isNaN(info.size)) {
        return info.size;
      }
    } catch {}

    // 2) Fallback: fetch blob từ webview-local server
    try {
      const url = Capacitor.convertFileSrc(path);
      const res = await fetch(url);
      const blob = await res.blob();
      return blob.size;
    } catch {}

    return undefined;
  }
}
