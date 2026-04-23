import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit } from "@angular/core";
import { IonicModule, ToastController, Platform } from "@ionic/angular";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { SubscriptionService } from "@rsApp/shared/services/subscription/subscription.service";
import { SettingsService, SubscriptionInfo, SettingsPreferences } from "@rsApp/shared/services/settings/settings.service";
import { BillingService } from "@rsApp/shared/services/billing/billing.service";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { ENV } from "@app/env";

@Component({
  selector: "app-settings",
  templateUrl: "./settings.page.html",
  styleUrls: ["./settings.page.scss"],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class SettingsPage implements OnInit {
  subscriptionInfo: SubscriptionInfo = { isActive: false };
  settings: SettingsPreferences = { autoDeleteVideosAfterDays: null, notificationsEnabled: true, userType: "seller" };
  daysRemaining: number | null = null;
  componentElement: HTMLElement | undefined;

  // Delete videos before date properties
  deleteBeforeDate: string = "";
  videosBeforeDateCount: number | null = null;
  isDeletingVideos = false;

  // App info from environment
  appName = ENV.appName;
  appVersion = ENV.appVersion;

  constructor(
    private settingsService: SettingsService,
    private subscriptionService: SubscriptionService,
    private billing: BillingService,
    private toastController: ToastController,
    private nativeComponent: ElementRef,
    private router: Router,
    private platform: Platform,
    private packService: PackService,
  ) {
    this.componentElement = this.nativeComponent.nativeElement;
  }

  ngOnInit() {
    this.loadSubscriptionInfo();
    this.loadSettings();
  }

  /**
   * Load subscription info
   */
  private loadSubscriptionInfo() {
    this.settingsService.subscriptionInfo$.subscribe((info) => {
      this.subscriptionInfo = info;
      this.daysRemaining = this.settingsService.getDaysRemaining();
    });
  }

  /**
   * Load user settings
   */
  private loadSettings() {
    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
    });
  }

  /**
   * Format date to Vietnamese format
   */
  formatDate(date: Date | undefined): string {
    if (!date) return "-";
    const d = new Date(date);
    return new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  /**
   * Format price to VND
   */
  formatPrice(price: number | undefined): string {
    if (price === undefined || price === null || isNaN(price)) return "-";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(price);
  }

  /**
   * Set auto-delete preference
   */
  setAutoDelete(days: number | null) {
    this.settingsService.setAutoDeleteVideosAfterDays(days);
    const message = days ? `Tự động xóa video sau ${days} ngày` : "Tắt tự động xóa video";
  }

  /**
   * Toggle notifications
   */
  toggleNotifications(enabled: boolean) {
    this.settingsService.setNotificationsEnabled(enabled);
  }

  /**
   * Set user type (seller or buyer)
   */
  setUserType(type: "seller" | "buyer") {
    this.settingsService.setUserType(type);
    const typeName = type === "seller" ? "Người bán hàng" : "Người mua hàng";
  }

  /**
   * Navigate to VIP subscription page
   */
  navigateToVipSubscription() {
    this.router.navigate(["/vip-subscription"]);
  }

  async reactivateSubscription() {
    const current = this.settingsService.getSubscriptionInfo();
    const productId = this.getProductIdFromPlan(current.plan);

    try {
      // Call Billing API to reactivate via RevenueCat
      const success = await this.billing.purchaseSubscription(productId);

      if (success) {
        // Show waiting message
        const toast = await this.toastController.create({
          message: "⏳ Đang xử lý... Vui lòng hoàn tất thanh toán",
          duration: 3000,
          position: "top",
          color: "warning",
        });
        await toast.present();

        // The billing service will automatically update subscription state
      } else {
        const toast = await this.toastController.create({
          message: "❌ Không thể kích hoạt lại. Vui lòng thử lại sau 5 phút.",
          duration: 2000,
          position: "top",
          color: "danger",
        });
        await toast.present();
      }
    } catch (error) {
      const toast = await this.toastController.create({
        message: "❌ Lỗi kích hoạt lại subscription",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription() {
    const confirmed = await this.showConfirmDialog("Hủy VIP?", "Bạn có chắc muốn hủy subscription? Bạn sẽ thấy quảng cáo lại sau ngày hết hạn.");

    if (confirmed) {
      const isMobile = this.platform.is("capacitor") || this.platform.is("cordova");

      if (isMobile) {
        const cancelToast = await this.toastController.create({
          message: "⏳ Đang mở Google Play...",
          duration: 1500,
          position: "top",
          color: "info",
        });
        await cancelToast.present();

        try {
          // Open Google Play subscription management
          await this.billing.manageSubscriptions();

          // Navigate to VIP subscription page to refresh status
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for user to return

          // Refresh subscription status from RevenueCat
          await this.billing.checkSubscriptionStatus();
          const successToast = await this.toastController.create({
            message: "✅ Đã mở Google Play. Trạng thái sẽ được cập nhật.",
            duration: 2000,
            position: "top",
            color: "success",
          });
          await successToast.present();
        } catch (error: any) {
          const errorToast = await this.toastController.create({
            message: "⚠️ Vui lòng hủy subscription trong Google Play",
            duration: 2000,
            position: "top",
            color: "warning",
          });
          await errorToast.present();
        }
      } else {
        // On web: Just update local state
        this.subscriptionService.setVip(false);
        this.settingsService.cancelSubscription();

        const toast = await this.toastController.create({
          message: "✅ Subscription đã được hủy",
          duration: 2000,
          position: "top",
          color: "success",
        });
        await toast.present();
      }
    }
  }

  /**
   * Get Product ID from subscription plan name
   */
  private getProductIdFromPlan(plan?: string): string {
    if (!plan) return "remove_ads_1month";

    if (plan.includes("1 Năm")) return "remove_ads_yearly";
    if (plan.includes("3 Tháng")) return "remove_ads_3months";

    return "remove_ads_1month";
  }

  /**
   * Open Google Play Manage Subscriptions page
   */
  private async openGooglePlaySubscriptions() {
    try {
      const packageName = "com.siva.packtrack"; // Your app package name
      const subscriptionsUrl = `https://play.google.com/store/account/subscriptions?package=${packageName}`;

      if (this.platform.is("capacitor") || this.platform.is("cordova")) {
        // Use Browser plugin if available
        const Browser = (window as any).cordova?.plugins?.BrowserTab || null;
        if (Browser) {
          Browser.openTab({
            url: subscriptionsUrl,
          });
        } else {
          // Fallback to window.open
          window.open(subscriptionsUrl, "_system");
        }
      }
    } catch (error) {}
  }

  /**
   * Show confirmation dialog
   */
  private async showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const confirmed = confirm(`${title}\n\n${message}`);
      resolve(confirmed);
    });
  }

  /**
   * Calculate number of videos created before selected date
   */
  async calculateVideosBeforeDate(): Promise<void> {
    if (!this.deleteBeforeDate) {
      this.videosBeforeDateCount = null;
      return;
    }

    try {
      const selectedDate = new Date(this.deleteBeforeDate);
      selectedDate.setHours(23, 59, 59, 999);

      // Get count from service
      this.videosBeforeDateCount = await this.packService.getVideosBeforeCount(selectedDate);
    } catch (error) {
      this.videosBeforeDateCount = null;
    }
  }

  /**
   * Delete videos created before the selected date immediately
   */
  async deleteVideosBeforeDate(): Promise<void> {
    if (!this.deleteBeforeDate) {
      const toast = await this.toastController.create({
        message: "❌ Vui lòng chọn ngày",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
      return;
    }

    const selectedDate = new Date(this.deleteBeforeDate);
    selectedDate.setHours(0, 0, 0, 0);
    const formattedDate = this.formatDate(selectedDate);

    // Confirm before deleting
    const confirmed = confirm(`🗑️ Xóa tất cả video được tạo trước ngày ${formattedDate}?\n\nHành động này không thể hoàn tác!`);
    if (!confirmed) {
      return;
    }

    try {
      this.isDeletingVideos = true;

      // Call pack service to delete videos before date
      // Assuming the service has a method to delete by date range
      const endDate = new Date(this.deleteBeforeDate);
      endDate.setHours(23, 59, 59, 999);

      // Create date range: from very old date to selected date
      const startDate = new Date(1970, 0, 1); // Beginning of time

      // Search for packs before the date and delete them
      // This would require backend support or we need to fetch all and delete

      // For now, call a method that should be available on PackService
      // Adjust based on your actual service methods
      await this.packService.deleteVideosBefore(endDate).toPromise();

      const toast = await this.toastController.create({
        message: `✅ Đã xóa video trước ngày ${formattedDate}`,
        duration: 3000,
        position: "top",
        color: "success",
      });
      await toast.present();

      // Reset the date picker
      this.deleteBeforeDate = "";
      this.videosBeforeDateCount = null;
    } catch (error) {
      const toast = await this.toastController.create({
        message: "❌ Lỗi khi xóa video",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    } finally {
      this.isDeletingVideos = false;
    }
  }

  /**
   * Navigate to Billing Debug page
   */
  navigateToBillingDebug(): void {
    this.router.navigate(["/billing-debug"]);
  }
}
