import { Injectable } from "@angular/core";
import { Platform } from "@ionic/angular";
import { FirebaseService } from "../firebase-service/firebase.service";

/**
 * Momo Payment Service
 * Handles Momo wallet payments via QR code or deep link
 */
@Injectable({
  providedIn: "root",
})
export class MomoService {
  // Momo app package name for Android
  private readonly MOMO_PACKAGE = "com.mservice.momotransfer";
  private readonly MOMO_SCHEME = "momo://";

  private momoAccount: { phone: string; name: string } = {
    phone: "",
    name: "",
  };

  constructor(
    private platform: Platform,
    private firebaseService: FirebaseService,
  ) {
    this.initializeMomoAccount();
  }

  /**
   * Initialize Momo account from Firebase config
   */
  private async initializeMomoAccount(): Promise<void> {
    try {
      const config = await this.firebaseService.getConfig();
      if (config?.momoAccount) {
        // Parse momoAccount format: "phone|name" or JSON
        try {
          // Try JSON format first
          const parsed = JSON.parse(config.momoAccount);
          this.momoAccount = parsed;
        } catch {
          // Fallback to pipe-separated format: "phone|name"
          const [phone, name] = config.momoAccount.split("|").map((s: string) => s.trim());
          if (phone) {
            this.momoAccount = { phone, name: name || "" };
          }
        }
        console.log("💳 [MomoService] Account loaded from Firebase:", this.momoAccount);
      }
    } catch (error) {
      console.error("❌ [MomoService] Failed to load Momo account:", error);
    }
  }

  /**
   * Get Momo account (with fallback)
   */
  private getMomoAccount(): { phone: string; name: string } {
    return this.momoAccount && this.momoAccount.phone ? this.momoAccount : { phone: "0961090433", name: "Nguyen Tan Quang" }; // Fallback
  }

  /**
   * Show Momo payment QR code modal or open app directly
   * @param amount - Payment amount in VND
   * @param description - Payment description
   * @param phoneNumber - Optional merchant phone number
   */
  async openMomoPayment(amount: number, description: string = "Ủng hộ PackTrack", phoneNumber?: string): Promise<boolean> {
    try {
      // Show Momo QR code modal
      await this.showMomoQRCode(amount, description, phoneNumber);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Show QR code for Momo payment
   */
  private async showMomoQRCode(amount: number, description: string, phoneNumber?: string): Promise<void> {
    try {
      const account = this.getMomoAccount();
      const merchantPhone = phoneNumber || account.phone;

      // Generate Momo deep link for QR code
      const momoLink = this.buildMomoDeepLink(amount, description, merchantPhone);

      // Generate QR code URL
      const qrUrl = this.generateQRCodeUrl(momoLink);

      // Remove existing modal if any
      const existingModal = document.getElementById("momo-qr-modal");
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal/popup with QR code
      const qrModal = document.createElement("div");
      qrModal.id = "momo-qr-modal";
      qrModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      `;

      const qrContent = document.createElement("div");
      qrContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 420px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      `;

      qrContent.innerHTML = `
        <div style="text-align: center;">
          <h2 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">📲 QR Code Thanh toán Momo</h2>
          
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: center; min-height: 300px;" id="momo-qr-container">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
              <div style="animation: spin 1s linear infinite; display: inline-block;">⏳</div>
              <span style="color: #999; font-size: 13px;">Đang tạo mã QR...</span>
            </div>
          </div>

          <div style="text-align: left; background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; border-left: 3px solid #A62BA6;">
            <p style="margin: 8px 0; color: #333; line-height: 1.6;">
              <strong style="color: #A62BA6;">👤 Người nhận:</strong> ${account.name}<br/>
              <strong style="color: #A62BA6;">📱 Số điện thoại:</strong> ${merchantPhone}<br/>
              <strong style="color: #A62BA6;">💰 Số tiền:</strong> <span style="color: #D32F2F; font-weight: bold;">${amount.toLocaleString("vi-VN")} VND</span><br/>
              <strong style="color: #A62BA6;">📝 Nội dung:</strong> ${description}
            </p>
          </div>

          <p style="color: #666; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">
            💡 Mở ứng dụng Momo và quét QR code này để thực hiện thanh toán
          </p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="close-momo-modal" style="
              flex: 1;
              min-width: 120px;
              padding: 10px;
              border: 1px solid #ddd;
              background: #f5f5f5;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='#efefef'" onmouseout="this.style.background='#f5f5f5'">Đóng</button>
            <button id="open-momo-app" style="
              flex: 1;
              min-width: 120px;
              padding: 10px;
              background: #A62BA6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='#9620A0'" onmouseout="this.style.background='#A62BA6'">🔗 Mở Momo</button>
          </div>
        </div>
        
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      qrModal.appendChild(qrContent);
      document.body.appendChild(qrModal);

      // Load QR code image
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        console.log("✅ [Momo] QR Code loaded successfully");
        const container = document.getElementById("momo-qr-container");
        if (container) {
          container.innerHTML = `<img src="${qrUrl}" alt="Momo QR Code" style="width: 260px; height: 260px; border-radius: 8px; background: white; padding: 8px;" />`;
        }
      };

      img.onerror = () => {
        console.error("❌ [Momo] QR Code failed to load from URL:", qrUrl);
        const container = document.getElementById("momo-qr-container");
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
              <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
              <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                Không thể tạo mã QR.<br/>
                Bấm "Mở Momo" để tiếp tục.
              </p>
            </div>
          `;
        }
      };

      img.src = qrUrl;

      // Close button handler
      const closeBtn = document.getElementById("close-momo-modal");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          qrModal.remove();
        });
      }

      // Open Momo app button handler
      const openMomoBtn = document.getElementById("open-momo-app");
      if (openMomoBtn) {
        openMomoBtn.addEventListener("click", async () => {
          console.log("🔗 [Momo] Opening Momo app with deep link...");
          window.location.href = momoLink;
          // Close modal after delay
          setTimeout(() => {
            qrModal.remove();
          }, 1000);
        });
      }

      // Close modal when clicking outside
      qrModal.addEventListener("click", (e) => {
        if (e.target === qrModal) {
          qrModal.remove();
        }
      });

      console.log("✅ [Momo] QR Code modal displayed");
    } catch (error) {
      console.error("❌ [Momo] Error showing QR code:", error);
    }
  }

  /**
   * Generate QR code URL
   */
  private generateQRCodeUrl(data: string): string {
    // Use qr-server API for reliable QR code generation
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
  }

  /**
   * Build Momo deep link for payment
   * Format: momo://transfer?amount=<amount>&description=<description>&phoneNumber=<phoneNumber>
   */
  private buildMomoDeepLink(amount: number, description: string, phoneNumber?: string): string {
    const params = new URLSearchParams();
    params.append("amount", String(amount));
    params.append("description", encodeURIComponent(description));

    if (phoneNumber) {
      params.append("phoneNumber", phoneNumber);
    }

    // Merchant info (PackTrack)
    params.append("appScheme", "com.siva.packtrack");

    return `${this.MOMO_SCHEME}transfer?${params.toString()}`;
  }

  /**
   * Check if Momo app is installed on device
   */
  private async checkMomoInstalled(): Promise<boolean> {
    try {
      // For testing - assume Momo is available
      console.log("✅ [Momo] Momo app check skipped - using QR code modal");
      return true;
    } catch (error) {
      console.error("❌ [Momo] Error checking Momo installation:", error);
      return false;
    }
  }

  /**
   * Handle Momo payment callback (if app returns to this app)
   * @param resultUrl - Result URL returned by Momo
   */
  handleMomoCallback(resultUrl: string): boolean {
    try {
      console.log("📨 [Momo] Handling callback:", resultUrl);

      // Parse callback URL for payment status
      const url = new URL(resultUrl);
      const status = url.searchParams.get("status");
      const message = url.searchParams.get("message");

      if (status === "0" || status === "success") {
        console.log("✅ [Momo] Payment successful:", message);
        return true;
      } else {
        console.warn("❌ [Momo] Payment failed:", message);
        return false;
      }
    } catch (error) {
      console.error("❌ [Momo] Error parsing callback:", error);
      return false;
    }
  }

  /**
   * Get Momo diagnostics
   */
  getDiagnostics(): any {
    return {
      momoPackage: this.MOMO_PACKAGE,
      momoScheme: this.MOMO_SCHEME,
      platform: this.platform,
    };
  }
}
