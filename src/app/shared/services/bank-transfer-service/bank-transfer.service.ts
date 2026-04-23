import { Injectable } from "@angular/core";
import { Platform } from "@ionic/angular";
import { FirebaseService } from "../firebase-service/firebase.service";

/**
 * Bank Transfer Service
 * Handles bank transfer via:
 * 1. QR Code (VietQR) - Recommended for modern phones
 * 2. Manual bank details - Fallback
 */
@Injectable({
  providedIn: "root",
})
export class BankTransferService {
  private bankAccount: {
    name: string;
    accountNumber: string;
    accountName: string;
    branch?: string;
    bin?: string;
  } = {
    name: "Vietcombank",
    accountNumber: "0411000123456",
    accountName: "SIVA",
  };

  constructor(private platform: Platform, private firebaseService: FirebaseService) {
    this.initializeBankAccount();
  }

  /**
   * Initialize bank account from Firebase config
   */
  private async initializeBankAccount(): Promise<void> {
    try {
      const config = await this.firebaseService.getConfig();
      if (config?.bankAccount) {
        // Parse bankAccount format: "name|accountNumber|accountName|branch|bin" or JSON
        try {
          // Try JSON format first
          const parsed = JSON.parse(config.bankAccount);
          this.bankAccount = parsed;
        } catch {
          // Fallback to pipe-separated format
          const parts = config.bankAccount.split("|").map((s: string) => s.trim());
          if (parts[0]) {
            this.bankAccount = {
              name: parts[0],
              accountNumber: parts[1] || this.bankAccount.accountNumber,
              accountName: parts[2] || this.bankAccount.accountName,
              branch: parts[3],
              bin: parts[4],
            };
          }
        }
      }
    } catch (error) {
    }
  }

  /**
   * Get bank account (with fallback)
   */
  private getBankAccount(): any {
    return this.bankAccount && this.bankAccount.accountNumber
      ? this.bankAccount
      : { name: "Vietcombank", accountNumber: "0411000123456", accountName: "SIVA" }; // Fallback
  }

  /**
   * Open bank transfer with QR code (primary) or fallback options
   * @param amount - Transfer amount in VND
   * @param description - Transfer description
   * @param bankCode - Bank code (vcb, vib, agribank)
   */
  async openBankTransfer(amount: number, description: string = "Ủng hộ PackTrack", bankCode: string = "vcb"): Promise<boolean> {
    try {
      const bankAccount = this.getBankAccount();
      if (!bankAccount) {
        return false;
      }

      // Primary: Show QR code
      await this.showQRCodeTransfer(amount, description, bankCode);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate VietQR format URL for bank transfer
   * VietQR is the standard QR format used by all Vietnamese banks
   */
  private generateVietQRUrl(amount: number, accountNumber: string, accountName: string, description: string, bankBin: string): string {
    // Using qr-server which generates QR codes reliably
    // This creates a URL that encodes the bank transfer payload

    // VietQR format (compact format):
    // https://vietqr.io generates but has CORS issues
    // Instead, use the bank transfer data directly encoded in QR

    const bankTransferData = `00020126470012vn.vietqr01051${bankBin}01031${accountNumber}0208QRCPV63370416${description}540510${amount}9703020000000637043d71`;

    // Use qr-server API which is more reliable
    // Encode the bank transfer data or generate from VietQR standard
    const qrString = encodeURIComponent(bankTransferData);

    // Try multiple fallback QR services
    // Primary: qr-server.com (most reliable)
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrString}`;
  }

  /**
   * Show QR code for bank transfer in modal
   */
  private async showQRCodeTransfer(amount: number, description: string, bankCode: string): Promise<void> {
    try {
      const bankAccount = this.getBankAccount();

      // Generate QR code URL
      const qrUrl = this.generateVietQRUrl(amount, bankAccount.accountNumber, bankAccount.accountName, description, bankAccount.bin);

      // Remove existing modal if any
      const existingModal = document.getElementById("bank-qr-modal");
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal/popup with QR code
      const qrModal = document.createElement("div");
      qrModal.id = "bank-qr-modal";
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
          <h2 style="margin: 0 0 16px 0; color: #333; font-size: 18px; font-weight: 600;">📲 QR Code Chuyển Khoản</h2>
          
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: center; min-height: 300px;" id="qr-container">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;">
              <div style="animation: spin 1s linear infinite; display: inline-block;">⏳</div>
              <span style="color: #999; font-size: 13px;">Đang tạo mã QR...</span>
            </div>
          </div>

          <div style="text-align: left; background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; border-left: 3px solid #0052CC;">
            <p style="margin: 8px 0; color: #333; line-height: 1.6;">
              <strong style="color: #0052CC;">Ngân hàng:</strong> ${bankAccount.name}<br/>
              <strong style="color: #0052CC;">Tài khoản:</strong> ${bankAccount.accountNumber}<br/>
              <strong style="color: #0052CC;">Chủ tài khoản:</strong> ${bankAccount.accountName}<br/>
              <strong style="color: #0052CC;">Số tiền:</strong> <span style="color: #D32F2F; font-weight: bold;">${amount.toLocaleString("vi-VN")} VND</span><br/>
              <strong style="color: #0052CC;">Nội dung:</strong> ${description}
            </p>
          </div>

          <p style="color: #666; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">
            💡 Sử dụng ứng dụng ngân hàng để quét QR code này hoặc sao chép thông tin chuyển khoản
          </p>

          <div style="display: flex; gap: 8px;">
            <button id="close-qr-modal" style="
              flex: 1;
              padding: 10px;
              border: 1px solid #ddd;
              background: #f5f5f5;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='#efefef'" onmouseout="this.style.background='#f5f5f5'">Đóng</button>
            <button id="copy-details" style="
              flex: 1;
              padding: 10px;
              background: #0052CC;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            " onmouseover="this.style.background='#0047B2'" onmouseout="this.style.background='#0052CC'">📋 Sao chép</button>
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
        const container = document.getElementById("qr-container");
        if (container) {
          container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width: 260px; height: 260px; border-radius: 8px; background: white; padding: 8px;" />`;
        }
      };

      img.onerror = () => {
        const container = document.getElementById("qr-container");
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
              <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
              <p style="margin: 0; font-size: 13px; line-height: 1.5;">
                Không thể tạo mã QR.<br/>
                Vui lòng sao chép thông tin chuyển khoản bên dưới.
              </p>
            </div>
          `;
        }
      };

      img.src = qrUrl;

      // Close button handler
      const closeBtn = document.getElementById("close-qr-modal");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          qrModal.remove();
        });
      }

      // Copy details button handler
      const copyBtn = document.getElementById("copy-details");
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const bankDetails = `
Ngân hàng: ${bankAccount.name}
Số tài khoản: ${bankAccount.accountNumber}
Chủ tài khoản: ${bankAccount.accountName}
Số tiền: ${amount.toLocaleString("vi-VN")} VND
Nội dung: ${description}
          `.trim();

          await this.copyToClipboard(bankDetails);

          // Show feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "✅ Đã sao chép!";
          copyBtn.style.background = "#4CAF50";
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = "#0052CC";
          }, 2000);
        });
      }

      // Close modal when clicking outside
      qrModal.addEventListener("click", (e) => {
        if (e.target === qrModal) {
          qrModal.remove();
        }
      });

    } catch (error) {
      // Fallback to bank details
      await this.showBankDetails(amount, bankCode);
    }
  }

  /**
   * Show bank details dialog for manual transfer (fallback)
   */
  async showBankDetails(amount: number, bankCode: string = "vcb"): Promise<void> {
    try {
      const bankAccount = this.getBankAccount();
      if (!bankAccount) {
        return;
      }

      const bankDetails = `
📌 CHUYỂN KHOẢN NGÂN HÀNG

Ngân hàng: ${bankAccount.name}
Chi nhánh: ${bankAccount.branch}
Số tài khoản: ${bankAccount.accountNumber}
Tên tài khoản: ${bankAccount.accountName}
Số tiền: ${amount.toLocaleString("vi-VN")} VND

📝 Nội dung chuyển khoản:
"Ủng hộ PackTrack - ${amount} VND"`;

      // Copy to clipboard
      this.copyToClipboard(bankDetails);

      // Show alert
      alert(bankDetails + "\n\n✅ Thông tin đã được sao chép vào bộ nhớ tạm!\n\nVui lòng chuyển khoản vào tài khoản trên.");

    } catch (error) {
    }
  }

  /**
   * Copy text to clipboard
   */
  private async copyToClipboard(text: string): Promise<void> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    } catch (error) {
    }
  }

  /**
   * Get diagnostics
   */
  getDiagnostics(): any {
    return {
      bankAccount: this.bankAccount,
      platform: this.platform,
    };
  }
}
