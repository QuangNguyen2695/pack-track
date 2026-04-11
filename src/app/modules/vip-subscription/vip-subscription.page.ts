import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NavController } from "@ionic/angular";
import { IonicModule } from "@ionic/angular";
import { SubscriptionService } from "@rsApp/shared/services/subscription/subscription.service";
import { SettingsService, SubscriptionInfo } from "@rsApp/shared/services/settings/settings.service";
import { BillingService } from "@rsApp/shared/services/billing/billing.service";
import { ToastController, Platform } from "@ionic/angular";

interface VipPackage {
  id: string;
  name: string;
  duration: number; // tháng
  price: number;
  originalPrice: number;
  discount: number; // %
  features: string[];
  recommended?: boolean;
  productId: string; // Google Play product ID (e.g., "remove_ads_1month")
}

@Component({
  selector: "app-vip-subscription",
  templateUrl: "./vip-subscription.page.html",
  styleUrls: ["./vip-subscription.page.scss"],
  standalone: false,
})
export class VipSubscriptionPage implements OnInit {
  packages: VipPackage[] = [
    {
      id: "1month",
      name: "1 Tháng",
      duration: 1,
      price: 29000,
      originalPrice: 58000,
      discount: 50,
      features: ["Bỏ tất cả quảng cáo", "Truy cập đầy đủ tính năng", "Giảm 50% so với giá gốc", "Dùng thử 7 ngày miễn phí", "Hủy bất cứ lúc nào"],
      productId: "$rc_monthly", // RevenueCat Package ID
    },
    {
      id: "3months",
      name: "3 Tháng",
      duration: 3,
      price: 69000,
      originalPrice: 174000,
      discount: 60,
      features: ["Bỏ tất cả quảng cáo", "Truy cập đầy đủ tính năng", "Giảm 60% so với giá gốc", "Dùng thử 7 ngày miễn phí", "Hủy bất cứ lúc nào"],
      recommended: true,
      productId: "$rc_three_month", // RevenueCat Package ID
    },
    {
      id: "1year",
      name: "1 Năm",
      duration: 12,
      price: 228000,
      originalPrice: 696000,
      discount: 67,
      features: ["Bỏ tất cả quảng cáo", "Truy cập đầy đủ tính năng", "Giảm 67% so với giá gốc", "Dùng thử 7 ngày miễn phí", "Hủy bất cứ lúc nào"],
      productId: "$rc_annual", // RevenueCat Package ID
    },
  ];

  selectedPackage: VipPackage | null = null;
  isProcessing = false;

  constructor(
    private navController: NavController,
    private subscriptionService: SubscriptionService,
    private settingsService: SettingsService,
    private billing: BillingService,
    private toastController: ToastController,
    private platform: Platform,
  ) {}

  ngOnInit() {
    console.error("💎 [VIP] Subscription page loaded");
    this.refreshSubscriptionStatus();
  }

  /**
   * Refresh subscription status from RevenueCat
   * Called when page loads to sync latest status with backend
   */
  async refreshSubscriptionStatus(): Promise<void> {
    try {
      console.log("🔄 [VIP] Refreshing subscription status from RevenueCat...");
      await this.billing.checkSubscriptionStatus();
      console.log("✅ [VIP] Subscription status refreshed");
    } catch (error: any) {
      console.error("❌ [VIP] Failed to refresh subscription status:", error?.message || error);
      // Don't block page load if refresh fails
    }
  }

  /**
   * Get price per month for each package
   */
  getPricePerMonth(pkg: VipPackage): number {
    return Math.round(pkg.price / pkg.duration);
  }

  /**
   * Format price to VND string
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(price);
  }

  /**
   * Select package and show confirmation
   */
  selectPackage(pkg: VipPackage) {
    console.error("📦 [VIP] Selected package:", pkg.id);
    this.selectedPackage = pkg;
  }

  /**
   * Subscribe to selected package
   */
  async subscribe() {
    if (!this.selectedPackage) {
      const toast = await this.toastController.create({
        message: "Vui lòng chọn một gói",
        duration: 2000,
        position: "top",
        color: "warning",
      });
      await toast.present();
      return;
    }

    this.isProcessing = true;

    try {
      console.error(`💳 [VIP] Processing subscription for ${this.selectedPackage.name}...`);
      console.error(`📦 [VIP] Product ID: ${this.selectedPackage.productId}`);

      // Check if on mobile platform
      const isMobile = this.platform.is("capacitor") || this.platform.is("cordova");

      if (isMobile) {
        // Use RevenueCat Billing for real purchases
        console.error("🎮 [VIP] Using RevenueCat Billing...");

        // Pass the product ID to purchase the correct package
        const purchaseSuccess = await this.billing.purchaseSubscription(this.selectedPackage.productId);

        if (purchaseSuccess) {
          console.error("✅ [VIP] Purchase initiated - waiting for billing response");

          // The BillingService will handle the subscription update automatically
          // We just wait a bit and then navigate back
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const successToast = await this.toastController.create({
            message: `🎉 Chúc mừng! Bạn đã nâng cấp VIP ${this.selectedPackage.name}. Thưởng thức không quảng cáo!`,
            duration: 3000,
            position: "top",
            color: "success",
          });
          await successToast.present();

          // Navigate back after success
          setTimeout(() => {
            this.navController.back();
          }, 2000);
        } else {
          throw new Error("Purchase failed in RevenueCat Billing");
        }
      } else {
        // Fallback for testing on web - simulate purchase
        console.error("🌐 [VIP] Testing mode (web) - simulating purchase...");

        // Show processing toast
        const processingToast = await this.toastController.create({
          message: `Đang xử lý đăng ký ${this.selectedPackage.name}...`,
          duration: 3000,
          position: "top",
          color: "success",
        });
        await processingToast.present();

        // Simulate payment processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Calculate expiry date
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + this.selectedPackage.duration);

        // Create subscription info with correct plan name
        const subscriptionInfo: SubscriptionInfo = {
          isActive: true,
          plan: this.selectedPackage.name,
          startDate: startDate,
          expiryDate: expiryDate,
          price: this.selectedPackage.price,
        };

        // Update SubscriptionService and SettingsService
        this.subscriptionService.setVip(true);
        this.settingsService.setSubscription(subscriptionInfo);
        console.error(`✅ [VIP] Test subscription activated: ${this.selectedPackage.name} (${this.selectedPackage.productId})`);

        // Show success toast
        const successToast = await this.toastController.create({
          message: `🎉 Chúc mừng! Bạn đã nâng cấp lên VIP ${this.selectedPackage.name} (TEST MODE). Thưởng thức không quảng cáo!`,
          duration: 3000,
          position: "top",
          color: "success",
        });
        await successToast.present();

        // Navigate back to home after success
        setTimeout(() => {
          this.navController.back();
        }, 2000);
      }
    } catch (error) {
      console.error("❌ [VIP] Subscription failed:", error);

      const errorToast = await this.toastController.create({
        message: "Lỗi khi đăng ký. Vui lòng thử lại sau.",
        duration: 100000,
        position: "top",
        color: "danger",
      });
      await errorToast.present();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Go back to home
   */
  goBack() {
    console.error("⬅️ [VIP] Navigating back to home");
    this.navController.back();
  }
}
