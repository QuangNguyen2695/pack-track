// import { Component, ElementRef, OnDestroy, OnInit, ViewChild, NgZone } from "@angular/core";
// import { Platform, ToastController, AlertController } from "@ionic/angular";
// import { Capacitor } from "@capacitor/core";
// import type { PluginListenerHandle } from "@capacitor/core";

// import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
// import { LoadingService } from "@rsApp/shared/services/loadding-service/loading.service";
// import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
// import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
// import { PackService } from "@rsApp/shared/services/pack-service/pack.service";

// // ❌ KHÔNG import bất kỳ wrapper CameraXScanner.ts nào

// type RecState = "idle" | "previewing" | "recording" | "stopping";

// @Component({
//   selector: "app-scan-record",
//   templateUrl: "./scan-record.page.html",
//   styleUrls: ["./scan-record.page.scss"],
//   standalone: false,
// })
// export class ScanRecordOOldPage implements OnInit, OnDestroy {
//   @ViewChild("scannerFrame", { static: true }) scannerFrame!: ElementRef<HTMLDivElement>;

//   torchOn = false;
//   recording = false;
//   recState: RecState = "idle";
//   ready = false;

//   currentCode: string | null = null;
//   lastCodeAt = 0;
//   debounceMs = 600;
//   allowSameCodeAfterMs = 4000;

//   duration = 0;
//   durationTimeFormat = "00:00:00";
//   private timerId: any;

//   lastError = "";
//   infoText = "Đang khởi tạo camera...";
//   private subs: PluginListenerHandle[] = [];

//   successVoice = "/assets/sounds/success.mp3";
//   newOrderVoice = "/assets/sounds/start.mp3";
//   savingOrderVoice = "/assets/sounds/saving.mp3";
//   detectNewOrderVoice = "/assets/sounds/detect-new-order.mp3";

//   private ENABLE_AUDIO = false;
//   private _currentRecordingPath: string | null = null;

//   private _native: any | null = null;

//   constructor(
//     private plt: Platform,
//     private zone: NgZone,
//     private sound: SoundService,
//     private loading: LoadingService,
//     private credential: CredentialService,
//     private deviceInfo: DeviceInfoService,
//     private packService: PackService,
//     private toastCtl: ToastController,
//     private alertCtl: AlertController,
//   ) {}

//   private async waitForNativePlugin(name = "CameraXScanner", timeoutMs = 4000) {
//     const start = Date.now();
//     while (Date.now() - start < timeoutMs) {
//       const n = (globalThis as any)?.Capacitor?.Plugins?.[name];
//       if (n) { this._native = n; return n; }
//       await new Promise(r => setTimeout(r, 50));
//     }
//     throw new Error(`Native ${name} not available`);
//   }
//   private async native() { return this._native ?? this.waitForNativePlugin(); }

//   ngOnInit(): void {}

//   async ionViewWillEnter() {
//     await this.plt.ready();
//     if (!(this.plt.is("android") || this.plt.is("ios"))) return;

//     try {
//       await this.waitForNativePlugin(); // 🔴 Quan trọng
//     } catch (e: any) {
//       await this.alert("Lỗi", "Native plugin CameraXScanner chưa được đăng ký vào Bridge.");
//       return;
//     }

//     await this.bindPluginEvents();
//     await this.ensurePermissions();
//     await this.startPreview();
//   }

//   async ionViewWillLeave() { await this.stopAll(); }
//   ngOnDestroy(): void { this.stopAll(); this.clearSubs(); }

//   private async bindPluginEvents() {
//     const N = await this.native();
//     // Stub không phát sự kiện; giữ mẫu để sau bạn phát event thật
//     // this.subs.push(await N.addListener("barcodeScanned", (e:any)=>{ ... }))
//   }
//   private clearSubs() { this.subs.forEach(s => s?.remove?.()); this.subs = []; }

//   private async ensurePermissions() {
//     try {
//       const N = await this.native();
//       const r = await N.requestPermissions();
//       if (!r?.granted) await this.alert("Quyền camera", "Ứng dụng cần quyền camera (và micro nếu bật thu âm).");
//     } catch {}
//   }

//   private async startPreview() {
//     if (this.recState !== "idle") return;
//     this.loading.loadingOn();
//     this.infoText = "Đang bật camera...";
//     try {
//       const N = await this.native();
//       await N.startAnalysis({ enableTorch: this.torchOn });
//       this.recState = "previewing";
//       this.ready = true;
//       this.startTimer();
//       this.infoText = "Đưa mã vào khung để bắt đầu quay";
//     } catch (e: any) {
//       this.lastError = e?.message || "Không mở được camera";
//       this.alert("Lỗi", this.lastError);
//       this.recState = "idle";
//       this.ready = false;
//     } finally {
//       this.loading.loadingOff();
//     }
//   }

//   private async stopAll() {
//     try {
//       const N = await this.native().catch(() => null);
//       if (!N) return;
//       if (this.recState === "recording") {
//         this.recState = "stopping";
//         await N.stopRecording().catch(() => {});
//         await this.sleep(150);
//       }
//       await N.stopAnalysis().catch(() => {});
//     } finally {
//       this.recState = "idle";
//       this.recording = false;
//       this.torchOn = false;
//       this.stopTimer();
//       this.currentCode = null;
//       this.ready = false;
//       this.infoText = "Đã dừng camera";
//       this._currentRecordingPath = null;
//     }
//   }

//   // Các hàm record/persist giống bản bạn đang dùng; mình bỏ chi tiết để ngắn gọn
//   private async startRecordingFor(code: string) {
//     if (this.recState !== "previewing") return;
//     this.recState = "recording";
//     this.recording = true;
//     this.duration = 0;
//     const N = await this.native();
//     const r = await N.startRecording({ withAudio: this.ENABLE_AUDIO });
//     this._currentRecordingPath = r?.filePath || null;
//   }

//   private startTimer() {
//     this.stopTimer();
//     this.timerId = setInterval(() => {
//       if (this.recState === "idle") return;
//       this.duration++;
//       this.durationTimeFormat = this.format(this.duration);
//     }, 1000);
//   }
//   private stopTimer() { if (this.timerId) { clearInterval(this.timerId); this.timerId = null; } }
//   private format(total: number) {
//     const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
//     const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
//     return `${pad(h)}:${pad(m)}:${pad(s)}`;
//   }
//   private sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

//   private async toast(message: string, color: "success" | "warning" | "danger" | "medium" = "medium") {
//     const t = await this.toastCtl.create({ message, color, duration: 1600, position: "bottom" });
//     t.present();
//   }
//   private async alert(h: string, m: string) {
//     const a = await this.alertCtl.create({ header: h, message: m, buttons: ["OK"] });
//     a.present();
//   }
// }
