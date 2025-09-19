import { Component, ElementRef, OnDestroy, OnInit, ViewChild, NgZone } from "@angular/core";
import { Platform, ToastController, AlertController } from "@ionic/angular";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
import { LoadingService } from "@rsApp/shared/services/loadding-service/loading.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";

import { CameraBarcode } from "capacitor-camera-barcode";

// ❌ KHÔNG import bất kỳ wrapper CameraXScanner.ts nào

type RecState = "idle" | "previewing" | "recording" | "stopping";

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

  duration = 0;
  durationTimeFormat = "00:00:00";
  private timerId: any;

  lastError = "";
  infoText = "Đang khởi tạo camera...";
  private subs: PluginListenerHandle[] = [];

  successVoice = "/assets/sounds/success.mp3";
  newOrderVoice = "/assets/sounds/start.mp3";
  savingOrderVoice = "/assets/sounds/saving.mp3";
  detectNewOrderVoice = "/assets/sounds/detect-new-order.mp3";

  private ENABLE_AUDIO = false;
  private _currentRecordingPath: string | null = null;

  private _native: any | null = null;

  constructor(
    private plt: Platform,
    private zone: NgZone,
    private sound: SoundService,
    private loading: LoadingService,
    private credential: CredentialService,
    private deviceInfo: DeviceInfoService,
    private packService: PackService,
    private toastCtl: ToastController,
    private alertCtl: AlertController,
  ) {}

  ngOnInit(): void {}
  async ngOnDestroy(): Promise<void> {}

  async ionViewWillLeave() {
    await CameraBarcode.removeAllListeners();
    document.body.classList.remove("qrscanner");
  }

  async ionViewWillEnter() {
    // bật preview sau webview

    setTimeout(() => {
      document.body.classList.add("camera-preview-active");
    }, 500);

    await CameraBarcode.startPreview({ toBack: true, withAudio: true });

    // lắng nghe barcode
    CameraBarcode.addListener("barcode", async (e) => {
      const code = e.value;
      console.log("🚀 ~ ScanRecordPage ~ ionViewWillEnter ~ code:", code);
      if (!this.recording) {
        // bắt đầu ghi khi thấy mã đầu tiên
        await CameraBarcode.startRecording({ fileNamePrefix: code, quality: "sd" });
        this.recording = true;
        this.currentCode = code;
      } else if (this.currentCode !== code) {
        // cắt clip khi thấy mã mới
        const { uri } = await CameraBarcode.stopRecording();
        console.log("🚀 ~ ScanRecordPage ~ ionViewWillEnter ~ uriuriuriuriuriuriuriuriuriuriuriuriuriuriuriuri:", uri)
        // TODO: phát âm thanh + log/ghi server
        const result = await CameraBarcode.startRecording({ fileNamePrefix: code, quality: "sd" });
        this.currentCode = code;
      }
    });
  }
}
