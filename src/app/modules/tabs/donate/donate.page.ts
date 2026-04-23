import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonicModule, AlertController, ToastController } from "@ionic/angular";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { MomoService } from "@rsApp/shared/services/momo-service/momo.service";
import { BankTransferService } from "@rsApp/shared/services/bank-transfer-service/bank-transfer.service";
import { Pipe, PipeTransform } from "@angular/core";

/**
 * Format number to Vietnamese currency display (e.g., "1.000.000")
 */
@Pipe({
  name: "formatVnd",
  standalone: true,
})
export class FormatVndPipe implements PipeTransform {
  transform(value: number | string): string {
    if (!value) return "";
    const numValue = typeof value === "string" ? parseInt(String(value).replace(/\D/g, ""), 10) : value;
    if (isNaN(numValue)) return "";
    return numValue.toLocaleString("vi-VN");
  }
}

@Component({
  selector: "app-donate",
  templateUrl: "./donate.page.html",
  styleUrls: ["./donate.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule, NZModule, FormatVndPipe],
})
export class DonatePage implements OnInit {
  currentUser: any;
  componentElement: HTMLElement;
  selectedAmount: number = 50000;
  currentMessage: string = "";

  messagesByAmount = {
    5000: ["🥤 Em đỡ khát rồi!", "💰 Quang trọng là tình cảm thôi!", "❤️ Thật á!"],
    10000: ["🍙 Sáng mai em đỡ một bữa rồi!", "🍙 Nhoăm nhoăm!", "🍙 Cảm ơn vì đã cứu em 1 chén!"],
    50000: ["🍻 Em say rồi!", "🍻 Xịn quá! Hẹn ở bùi viện nhé!", "🍻 123 zô 123 uống"],
    100000: ["😍 Nay không ăn mì tôm nữa nhá!", "🔥 Thế này cay cấp độ 99 em cũng chịu!", "💪 Đừng chiều em hư đó!"],
    200000: ["🤩 Ngồi ngay ngắn em lạy 3 lạy!", "👑 Lẩu gì mà cay cay thế, Lẩu thái!", "🎊 Mai em giàu em ủng hộ vài đơn!"],
    500000: [
      "👑 VUA! VUA CỦA CHÚNG TÔI!",
      "🏆 Nổ cái địa chỉ em qua cảm ơn tận nhà!",
      "💎 Surgar Daddy/Mommy!",
      "🙏 Đường tao đi có quý nhân phù trợ!",
    ],
  };

  donationMethods = [
    { id: 1, name: "Momo", icon: "assets/icons/momo.svg", color: "#A62BA6" },
    { id: 2, name: "Ngân hàng", icon: "assets/icons/bank.svg", color: "#0052CC" },
  ];

  presetAmounts = [5000, 10000, 50000, 100000, 200000, 500000];

  constructor(
    private router: Router,
    private nativeComponent: ElementRef,
    private alertController: AlertController,
    private toastController: ToastController,
    private momoService: MomoService,
    private bankTransferService: BankTransferService,
  ) {
    this.componentElement = this.nativeComponent.nativeElement;
  }

  ngOnInit() {
    this.currentMessage = this.getRandomMessage(this.selectedAmount);
    this.initializeData();
  }

  async initializeData() {}

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.currentMessage = this.getRandomMessage(amount);
  }

  getRandomMessage(amount: number): string {
    // Kiểm xem có custom amount hay không
    const messages = (this.messagesByAmount as any)[amount];

    if (messages) {
      // Random từ các message có sẵn
      return messages[Math.floor(Math.random() * messages.length)];
    } else {
      // Custom amount - random từ các message custom
      const customMessages = [
        "💖 Đường tao đi có quý nhân phù trợ!",
        "❤️ Với số này, em như sống lại!",
        "❤️ Người như thế này sao không cho em gặp sớm hơn!",
      ];
      return customMessages[Math.floor(Math.random() * customMessages.length)];
    }
  }

  getRandomSuccessMessage(): string {
    const successMessages = [
      "👻 Em đang floating trong không trung!",
      "🎆 Pháo hoa nổ trong đầu em rồi!",
      "💸 Em đi mua vietlot ngay!",
      "🏆 Em sẽ dựng tượng anh ở quảng trường!",
      "🌟 Anh/Chị là ngôi sao của em!",
      "🎊 Em sẽ nhớ anh/chị đến hết đời!",
      "💝 Anh/Chị đẹp trai/gái lắm biết không?",
      "🚀 Em bay lên mây 9 rồi!",
      "👑 Ghi chép lại tên anh trong sổ vàng em!",
    ];
    return successMessages[Math.floor(Math.random() * successMessages.length)];
  }

  async selectDonationMethod(method: any) {
    // Validate amount
    if (!this.selectedAmount || this.selectedAmount <= 0) {
      const toast = await this.toastController.create({
        message: "⚠️ Vui lòng nhập số tiền hợp lệ!",
        duration: 2000,
        position: "top",
        color: "warning",
      });
      await toast.present();
      return;
    }

    await this.processPayment(method);
  }

  /**
   * Direct payment without confirmation - skips the alert for quick payment
   */
  async quickPaymentWithMethod(method: any) {
    // Validate amount
    if (!this.selectedAmount || this.selectedAmount <= 0) {
      const toast = await this.toastController.create({
        message: "⚠️ Vui lòng nhập số tiền hợp lệ!",
        duration: 2000,
        position: "top",
        color: "warning",
      });
      await toast.present();
      return;
    }

    await this.processPayment(method);
  }

  /**
   * Process payment based on donation method
   */
  private async processPayment(method: any) {
    try {

      let success = false;

      if (method.name === "Momo") {
        // Open Momo app
        success = await this.momoService.openMomoPayment(this.selectedAmount, "Ủng hộ SafeTrack");
      } else if (method.name === "Ngân hàng") {
        // Open bank transfer
        success = await this.bankTransferService.openBankTransfer(
          this.selectedAmount,
          "Ủng hộ SafeTrack",
          "vcb", // Default to Vietcombank
        );
      }

      if (success) {
        // Show success message - payment will complete in background
        await this.showSuccessMessage(method.name);
      } else {
        const toast = await this.toastController.create({
          message: `❌ Không thể mở ${method.name}. Vui lòng thử lại.`,
          duration: 2000,
          position: "top",
          color: "danger",
        });
        await toast.present();
      }
    } catch (error) {
      const toast = await this.toastController.create({
        message: "❌ Lỗi xử lý thanh toán",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    }
  }

  async showSuccessMessage(methodName: string) {
    const randomMessage = this.getRandomSuccessMessage();
    const alert = await this.alertController.create({
      header: "Cảm ơn bạn!",
      message: `Chúng tôi vô cùng cảm ơn sự ủng hộ của bạn. Khoản ủng hộ sẽ giúp chúng tôi phát triển ứng dụng tốt hơn mỗi ngày.\n\n${randomMessage}`,
      buttons: ["OK"],
    });
    await alert.present();
  }

  /**
   * Format number to VND display format (e.g., "1.000.000")
   */
  formatVndDisplay(value: number | string): string {
    if (!value) return "";
    const numValue = typeof value === "string" ? parseInt(value.replace(/\D/g, ""), 10) : value;
    if (isNaN(numValue)) return "";
    return numValue.toLocaleString("vi-VN");
  }

  /**
   * Handle amount input change - extract number and update state
   */
  onAmountChange(input: string) {
    // Extract only numbers from input
    const numValue = parseInt(input.replace(/\D/g, ""), 10);
    if (!isNaN(numValue) && numValue > 0) {
      this.selectedAmount = numValue;
      this.currentMessage = this.getRandomMessage(numValue);
    } else if (input === "") {
      this.selectedAmount = 0;
    }
  }

  /**
   * Handle keyboard down - allow only numbers and control keys
   */
  onAmountKeydown(event: KeyboardEvent) {
    const key = event.key;
    // Allow: Backspace, Delete, Tab, Escape, Enter, numbers
    if (
      ["Backspace", "Delete", "Tab", "Escape", "Enter"].includes(key) ||
      /^[0-9]$/.test(key) ||
      (event.ctrlKey && ["a", "c", "v", "x"].includes(key.toLowerCase()))
    ) {
      return; // Allow
    }
    // Block other keys
    event.preventDefault();
  }
}
