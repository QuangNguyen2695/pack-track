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

  // Serial queue
  private serialQueue: Promise<void> = Promise.resolve();

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
    await this.cam.stop();
    this.stopCounter();
    this.recording = false;
    document.body.classList.remove("camera-preview-active");
    this.recState = "idle";
  }

  private async requestCameraPermission() {
    try {
      await Camera.requestPermissions();
    } catch {}
  }

  // ====== Scan loop (fast + robust xen kẽ) ======
  private startScanLoop(intervalMs = 450) {
    this.stopScanLoop();
    this.scanLoopTimer = setInterval(async () => {
      if (this.scanningPaused || this.recState === "stopping") return;
      try {
        const base64 = await this.cam.captureSampleBase64(88);
        if (!base64) return;

        const dataUrl = `data:image/jpeg;base64,${base64}`;
        this.frameCount = (this.frameCount + 1) % 3;

        const result: Result | null =
          this.frameCount === 0
            ? await this.scanner.decodeRobust(dataUrl) // nặng, thưa
            : await this.scanner.decodeFast(dataUrl); // nhanh, thường xuyên
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
      this.seenCodes.add(code);

      if (this.recState === "recording") {
        try {
          await this.soundService.playAndWait(this.detectNewOrderVoice);
          await this.soundService.playAndWait(this.savingOrderVoice);
        } catch {}
        await this.stopInlineRecordingAndSave();
        try {
          await this.soundService.playAndWait(this.successVoice);
        } catch {}
        this.resetCounter();
      }

      await this.startNewOrder(code);
    });
  }

  // ====== Record flow ======
  private async startInlinePreview() {
    const opts: CameraPreviewOptions = {
      position: "rear",
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      toBack: true,
      storeToFile: false,
      disableAudio: false,
    };
    await this.cam.start(opts);
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
      // không pause scan để vừa quay vừa quét
      await this.cam.startRecord();
      await this.sleep(260);
      this.recording = true;
      this.recState = "recording";
    } catch (e) {
      this.recording = false;
      this.recState = "previewing";
      this.resumeScanLoop();
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
      await this.soundService.playAndWait(this.newOrderVoice);
      await this.startInlineRecording();
      this.startCounter();
    } catch {}
  }

  async saveVideo() {
    if (this.savingInProgress) return;
    this.savingInProgress = true;
    try {
      if (this.recState === "starting") {
        for (let i = 0; i < 5 && this.recState === "starting"; i++) await this.sleep(200);
      }
      if (this.recState !== "recording") return;

      this.video.endTime = new Date();
      this.video.name = this.video.orderCode;

      await this.soundService.playAndWait(this.savingOrderVoice);
      await this.stopInlineRecordingAndSave();
      await this.soundService.playAndWait(this.successVoice);
      this.resumeScanLoop();
    } finally {
      this.resetCounter();
      this.savingInProgress = false;
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

  async stopRecordingBtn() {
    await this.soundService.playAndWait(this.savingOrderVoice);
    const uri = await this.stopInlineRecordingAndSave();
    await this.soundService.playAndWait(this.successVoice);
    console.log("Saved to:", uri);
  }
}
