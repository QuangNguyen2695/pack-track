import { Component, ElementRef, OnDestroy, OnInit, ViewChild, NgZone, ChangeDetectorRef } from "@angular/core";
import { Platform, ToastController, AlertController } from "@ionic/angular";

import { SoundService } from "@rsApp/shared/services/sound-service/sound-service";
import { CameraBarcode } from "../../../plugin/CameraXScanner";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { ENV } from "src/environments/environment.development";

interface ScannedItem {
  barcode: string;
  timestamp: Date;
  format?: string;
}

@Component({
  selector: "app-scan",
  templateUrl: "./scan.page.html",
  styleUrls: ["./scan.page.scss"],
  standalone: false,
})
export class ScanPage implements OnInit, OnDestroy {
  @ViewChild("scannerFrame", { static: true }) scannerFrame!: ElementRef<HTMLDivElement>;

  torchOn = false;
  ready = false;
  scanning = false;

  // Scan configuration
  allowDuplicates = false; // Toggle để cho phép scan trùng
  allowSingleBarcode = false; // Toggle để chỉ scan 1 barcode

  // Scanned items array
  scannedItems: ScannedItem[] = [];
  lastScannedCode: string | null = null;

  // Scan timing control
  lastCodeAt = 0;
  debounceMs = 600;

  infoText = "Đang khởi tạo camera...";
  lastError = "";

  // Audio feedback
  successVoice = "/assets/sounds/success.mp3";
  detectVoice = "/assets/sounds/detect-new-order.mp3";

  // Scan control flags
  private scanBusy = false;
  private scanCooldownUntil = 0;

  constructor(
    private platform: Platform,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private sound: SoundService,
    private toastCtl: ToastController,
    private alertCtl: AlertController,
  ) {}

  ngOnInit(): void {
    // Khôi phục cấu hình từ localStorage
    try {
      const allowDup = localStorage.getItem("allowDuplicates");
      if (allowDup !== null) this.allowDuplicates = allowDup === "1";

      const singleMode = localStorage.getItem("allowSingleBarcode");
      if (singleMode !== null) this.allowSingleBarcode = singleMode === "1";
    } catch {}
  }

  async ngOnDestroy(): Promise<void> {
    // Cho phép màn hình tắt khi destroy page
    try {
      await KeepAwake.allowSleep();
      console.log("Keep awake deactivated");
    } catch (error) {
      console.warn("Failed to deactivate keep awake:", error);
    }

    await CameraBarcode.removeAllListeners().catch(() => {});
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

    await CameraBarcode.removeAllListeners().catch(() => {});
    document.body.classList.remove("qrscanner", "camera-preview-active");
    this.scanning = false;
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
    setTimeout(() => document.body.classList.add("camera-preview-active"), 300);
    this.infoText = "Đang mở camera...";

    await CameraBarcode.removeAllListeners().catch(() => {}); // tránh nhân listener
    await CameraBarcode.startPreview({ toBack: true, withAudio: false }); // Không cần audio cho scan
    this.scanning = true;
    this.infoText = "Sẵn sàng quét mã";

    // Test torch capabilities khi camera đã sẵn sàng
    await this.checkTorchCapabilities();

    await this.attachBarcodeListener();
  }

  private async attachBarcodeListener() {
    await CameraBarcode.addListener("barcode", async (e) => {
      const code = e?.value?.toString?.().trim?.() ?? e?.value;
      const format = e?.format ?? "UNKNOWN";
      const now = (e as any)?.ts ?? Date.now();
      await this.handleBarcodeEvent(code, format, now);
    });
  }

  private async handleBarcodeEvent(code: string | null, format: string, now: number) {
    if (!code) return;

    // Chặn khi đang xử lý hoặc đang cooldown
    if (this.scanBusy) return;
    if (now < this.scanCooldownUntil) return;

    // Debounce
    if (now - this.lastCodeAt < this.debounceMs) return;

    this.lastCodeAt = now;

    try {
      this.scanBusy = true;

      // Kiểm tra xem có phải barcode trùng không
      const isDuplicate = this.scannedItems.some((item) => item.barcode === code);

      if (isDuplicate && !this.allowDuplicates) {
        await this.toast(`⚠️ Mã "${code}" đã được quét trước đó`);
        this.scanCooldownUntil = now + 1000;
        return;
      }

      // Nếu chế độ single barcode và đã có item, không thêm nữa
      if (this.allowSingleBarcode && this.scannedItems.length > 0) {
        await this.toast("🚫 Chế độ 1 mã: Đã đạt giới hạn");
        this.scanCooldownUntil = now + 1000;
        return;
      }

      // Thêm vào danh sách
      const newItem: ScannedItem = {
        barcode: code,
        timestamp: new Date(),
        format: format,
      };

      this.scannedItems.unshift(newItem); // Thêm vào đầu danh sách (mới nhất trước)
      this.lastScannedCode = code;

      // Audio feedback
      await this.safePlay(this.detectVoice);

      // Toast success
      await this.toast(`✅ Đã quét: ${code}`);

      // Update UI
      this.cdr.detectChanges();

      this.scanCooldownUntil = now + 500; // Cooldown ngắn hơn cho scan
    } catch (error) {
      console.error("Scan handling error:", error);
      await this.toast("❌ Lỗi xử lý mã quét");
    } finally {
      this.scanBusy = false;
    }
  }

  // =================== ACTION BUTTONS ===================
  async toggleTorch() {
    try {
      console.log("Current torch state:", this.torchOn);
      console.log("Current scanning state:", this.scanning);

      // Kiểm tra xem có đang ở trạng thái có thể sử dụng torch không
      if (!this.scanning) {
        console.warn("Cannot toggle torch: camera not started");
        await this.toast("Vui lòng bật camera trước khi sử dụng đèn pin");
        return;
      }

      // Kiểm tra platform
      if (!this.platform.is("ios") && !this.platform.is("android")) {
        console.warn("Torch not supported on this platform");
        await this.toast("Đèn pin chỉ hỗ trợ trên mobile");
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
      console.log("Torch toggled successfully to:", this.torchOn);

      // Feedback cho user
      const message = this.torchOn ? "🔦 Đã bật đèn pin" : "🔦 Đã tắt đèn pin";
      await this.toast(message);
    } catch (error) {
      console.error("Failed to toggle torch:", error);

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

  // =================== CONFIGURATION TOGGLES ===================
  toggleAllowDuplicates() {
    this.allowDuplicates = !this.allowDuplicates;
    try {
      localStorage.setItem("allowDuplicates", this.allowDuplicates ? "1" : "0");
    } catch {}

    const message = this.allowDuplicates ? "✅ Cho phép quét trùng" : "🚫 Không cho phép quét trùng";
    this.toast(message);
  }

  toggleSingleBarcodeMode() {
    this.allowSingleBarcode = !this.allowSingleBarcode;
    try {
      localStorage.setItem("allowSingleBarcode", this.allowSingleBarcode ? "1" : "0");
    } catch {}

    const message = this.allowSingleBarcode ? "1️⃣ Chế độ 1 mã: BẬT" : "🔢 Chế độ nhiều mã: BẬT";
    this.toast(message);

    // Nếu bật chế độ single và đã có nhiều hơn 1 item, giữ lại item mới nhất
    if (this.allowSingleBarcode && this.scannedItems.length > 1) {
      this.scannedItems = [this.scannedItems[0]]; // Giữ lại item đầu tiên (mới nhất)
      this.toast("🗑️ Đã xóa các mã cũ, chỉ giữ lại 1 mã");
    }
  }

  // =================== LIST MANAGEMENT ===================
  removeItem(index: number) {
    if (index >= 0 && index < this.scannedItems.length) {
      const removedItem = this.scannedItems.splice(index, 1)[0];
      this.toast(`🗑️ Đã xóa: ${removedItem.barcode}`);
    }
  }

  clearAllItems() {
    if (this.scannedItems.length === 0) {
      this.toast("📋 Danh sách đã trống");
      return;
    }

    const itemCount = this.scannedItems.length;
    this.scannedItems = [];
    this.lastScannedCode = null;
    this.toast(`🗑️ Đã xóa ${itemCount} mã quét`);
  }

  async confirmClearAll() {
    if (this.scannedItems.length === 0) {
      this.toast("📋 Danh sách đã trống");
      return;
    }

    const alert = await this.alertCtl.create({
      header: "Xác nhận xóa",
      message: `Bạn có chắc muốn xóa tất cả ${this.scannedItems.length} mã đã quét?`,
      buttons: [
        {
          text: "Hủy",
          role: "cancel",
        },
        {
          text: "Xóa tất cả",
          role: "destructive",
          handler: () => {
            this.clearAllItems();
          },
        },
      ],
    });

    await alert.present();
  }

  // =================== EXPORT FUNCTIONALITY ===================
  // exportScannedItems() {
  //   if (this.scannedItems.length === 0) {
  //     this.toast("📋 Không có dữ liệu để xuất");
  //     return;
  //   }

  //   // Tạo text export
  //   const exportText = this.scannedItems
  //     .map((item, index) => `${index + 1}. ${item.barcode} (${item.format}) - ${item.timestamp.toLocaleString()}`)
  //     .join('\n');

  //   // Copy to clipboard (nếu có API)
  //   if (navigator.clipboard) {
  //     navigator.clipboard.writeText(exportText).then(() => {
  //       this.toast(`📄 Đã copy ${this.scannedItems.length} mã vào clipboard`);
  //     }).catch(() => {
  //       this.showExportModal(exportText);
  //     });
  //   } else {
  //     this.showExportModal(exportText);
  //   }
  // }

  private async showExportModal(text: string) {
    const alert = await this.alertCtl.create({
      header: "Danh sách mã quét",
      message: `<pre style="font-size: 12px; text-align: left;">${text}</pre>`,
      buttons: ["Đóng"],
    });

    await alert.present();
  }

  // =================== HELPER METHODS ===================
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
    }
  }

  private async safePlay(src: string) {
    try {
      await this.sound.playAndWait(src);
    } catch {}
  }

  private async toast(message: string) {
    const t = await this.toastCtl.create({
      message,
      duration: 2000,
      position: "bottom",
    });
    await t.present();
  }

  // =================== GETTERS FOR TEMPLATE ===================
  get totalScanned(): number {
    return this.scannedItems.length;
  }

  get uniqueScanned(): number {
    const uniqueCodes = new Set(this.scannedItems.map((item) => item.barcode));
    return uniqueCodes.size;
  }

  formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }
}
