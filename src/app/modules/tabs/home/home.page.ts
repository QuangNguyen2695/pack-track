import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnInit, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonicModule, NavController, ToastController } from "@ionic/angular";
import { Router } from "@angular/router";
import { AdmobService } from "@rsApp/shared/services/admob-service/dmob.service";
import { SubscriptionService } from "@rsApp/shared/services/subscription/subscription.service";
import { SettingsService } from "@rsApp/shared/services/settings/settings.service";
import { BillingService } from "@rsApp/shared/services/billing/billing.service";
import { StatisticsService, DailyStats } from "@rsApp/shared/services/statistics/statistics.service";
import { ENV } from "@app/env";
import { Subscription } from "rxjs";

@Component({
  selector: "app-home",
  templateUrl: "./home.page.html",
  styleUrls: ["./home.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class HomePage implements OnInit, OnDestroy {
  loading = false;
  showing = false;
  status = "idle";
  reward: { type: string; amount: number } | null = null;
  error: string | null = null;
  componentElement: HTMLElement | undefined;
  isPendingCancel = false; // Track if VIP is pending cancellation
  daysRemaining: number | null = null; // Days until VIP expires
  subscriptionInfo: any = { isActive: false }; // Track subscription info

  // Thống kê hôm nay
  todayStats: DailyStats = {
    date: "",
    adsPlayed: 0,
    videosRecorded: 0,
  };

  // Lấy từ Firebase config thông qua AdmobService
  adsRequiredPerDay = 5;

  private statsSubscription?: Subscription;
  private autoAdTimerId: any = null;
  private readonly AUTO_AD_INTERVAL = 5 * 60 * 1000; // 10 minutes in milliseconds
  private lastAdShowTime = 0;

  constructor(
    private toastController: ToastController,
    private ads: AdmobService,
    private nativeComponent: ElementRef,
    private statisticsService: StatisticsService,
    private subscriptionService: SubscriptionService,
    private settingsService: SettingsService,
    private billing: BillingService,
    private router: Router,
    private navController: NavController,
  ) {
    this.componentElement = this.nativeComponent.nativeElement;
  }

  async ngOnInit() {
    console.log("📱 [Home] Page loaded");
    await this.ads.init();
    this.adsRequiredPerDay = this.ads.adsRequiredPerDay;
    this.loadTodayStats();
    this.loadSubscriptionInfo();
    this.loadStats();
    this.startAutoAdTimer();
  }

  /**
   * Load subscription and VIP status
   */
  private loadSubscriptionInfo() {
    // Subscribe to subscription info for VIP status and pending cancellation
    this.settingsService.subscriptionInfo$.subscribe((info) => {
      this.subscriptionInfo = info;
      this.isPendingCancel = this.settingsService.isPendingCancellation();
      this.daysRemaining = this.settingsService.getDaysRemaining();
      console.log(
        `💎 [Home] Subscription updated - Active: ${info.isActive}, Pending cancel: ${this.isPendingCancel}, Days remaining: ${this.daysRemaining}`,
      );
    });
  }

  /**
   * Load stats and subscribe to updates
   */
  private loadStats() {
    this.statsSubscription = this.statisticsService.statsUpdated$.subscribe((updatedStats) => {
      console.log("🔄 [Home] Stats updated:", updatedStats);
      this.todayStats = updatedStats;
    });
  }

  ngOnDestroy() {
    // Cleanup subscription
    if (this.statsSubscription) {
      this.statsSubscription.unsubscribe();
    }
    // Stop auto ad timer
    this.stopAutoAdTimer();
  }

  async ionViewWillEnter() {
    // Refresh stats khi quay lại trang
    this.loadTodayStats();
  }

  /**
   * Load thống kê hôm nay
   */
  loadTodayStats() {
    this.todayStats = this.statisticsService.getTodayStats();
  }

  async preload() {
    this.loading = true;
    this.error = null;
    this.status = "preloading…";
    try {
      await this.ads.preloadRewarded();
      this.status = "preloaded ✅";
    } catch (e: any) {
      this.error = e?.message || String(e);
      this.status = "preload failed";
    } finally {
      // Refresh stats sau khi xem quảng cáo
      this.loadTodayStats();
      this.loading = false;
    }
  }

  async show() {
    this.showing = true;
    this.error = null;
    this.reward = null;
    this.status = "showing…";
    try {
      // showRewarded() trong service trả về AdMobRewardItem | null
      const r = await this.ads.showRewarded();
      if (r) {
        this.reward = r;
        this.status = "rewarded ✅";
      } else {
        this.status = "closed (no reward)";
      }
    } catch (e: any) {
      this.error = e?.message || String(e);
      this.status = "show failed";
    } finally {
      this.showing = false;
    }
  }

  /**
   * Watch rewarded ads - call when user clicks "Click để xem quảng cáo"
   */
  async watchRewardedAds() {
    this.loading = true;
    this.error = null;
    this.status = "loading…";

    try {
      console.log("📺 [Home] Showing rewarded ad...");
      const r = await this.ads.checkAndShowRewardAd();

      if (r) {
        // ✅ User completed the ad and got reward
        this.status = "rewarded ✅";
        this.lastAdShowTime = Date.now();

        // Reload stats sau khi xem quảng cáo
        await new Promise((resolve) => setTimeout(resolve, 500));
        this.loadTodayStats();

        const toast = await this.toastController.create({
          message: `✅ Cảm ơn! Bạn đã xem quảng cáo (${this.todayStats.adsPlayed}/${this.adsRequiredPerDay})`,
          duration: 2000,
          position: "top",
          color: "success",
        });
        await toast.present();
      } else {
        // ⚠️ No reward returned - could be user closed or ad not available
        this.status = "closed (no reward)";

        // Show a gentler message - don't show error, just informational
        const toast = await this.toastController.create({
          message: "⏸️ Quảng cáo chưa sẵn sàng. Vui lòng thử lại sau 5 phút.",
          duration: 2000,
          position: "top",
          color: "warning",
        });
        await toast.present();

        console.warn("⚠️ [Home] No reward ad available or user closed ad");
      }
    } catch (e: any) {
      // ❌ Error occurred while trying to show ad
      this.error = e?.message || String(e);
      this.status = "show failed";
      console.error("❌ [Home] Failed to show rewarded ad:", e);

      const toast = await this.toastController.create({
        message: `❌ ${this.error || "Lỗi khi tải quảng cáo"}`,
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }

  /**
   * Handle VIP subscription - navigate to VIP packages page
   */
  async navigateToVipSubscription() {
    this.navController.navigateForward(["/vip-subscription"]);
  }

  /**
   * Reactivate pending cancelled subscription
   */
  async reactivateSubscription() {
    const current = this.settingsService.getSubscriptionInfo();
    const productId = this.getProductIdFromPlan(current.plan);

    try {
      console.log(`🔄 [Home] Reactivating subscription with product: ${productId}`);

      // Call Billing API to reactivate via RevenueCat
      const success = await this.billing.purchaseSubscription(productId);

      if (success) {
        console.log("✅ [Home] Reactivation initiated via RevenueCat");

        // Show waiting message
        const toast = await this.toastController.create({
          message: "⏳ Đang xử lý... Vui lòng hoàn tất thanh toán",
          duration: 3000,
          position: "top",
          color: "warning",
        });
        await toast.present();

        // The billing service will automatically update subscription state
        console.log("⏳ [Home] Waiting for confirmation...");
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
      console.error("❌ [Home] Reactivation error:", error);

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

      // Use cordova browser plugin if available
      const Browser = (window as any).cordova?.plugins?.BrowserTab || null;
      if (Browser) {
        Browser.openTab({
          url: subscriptionsUrl,
        });
      } else {
        // Fallback to window.open
        window.open(subscriptionsUrl, "_system");
      }
      console.log("🌐 [Home] Opened Google Play Manage Subscriptions");
    } catch (error) {
      console.error("❌ [Home] Failed to open Google Play:", error);
      const toast = await this.toastController.create({
        message: "❌ Không thể mở Google Play. Vui lòng thăm https://play.google.com/store/account/subscriptions",
        duration: 3000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    }
    console.log("✅ [Home] VIP subscription reactivated");
  }

  /**
   * Start auto ad timer - show rewarded ad every 10 minutes
   */
  private startAutoAdTimer() {
    console.log("⏱️ [Home] Starting auto ad timer (10 min interval)");

    // Clear existing timer if any
    this.stopAutoAdTimer();

    // Set initial timer to trigger after 10 minutes
    this.autoAdTimerId = setInterval(async () => {
      const now = Date.now();
      const timeSinceLastAd = now - this.lastAdShowTime;

      // Insurance check: only show if at least 5 minutes have passed
      if (timeSinceLastAd >= 5 * 60 * 1000) {
        console.log("⏱️ [Home] Auto ad timer triggered - showing rewarded ad");
        await this.watchRewardedAds();
      }
    }, this.AUTO_AD_INTERVAL);
  }

  /**
   * Stop auto ad timer
   */
  private stopAutoAdTimer() {
    if (this.autoAdTimerId) {
      console.log("⏱️ [Home] Stopping auto ad timer");
      clearInterval(this.autoAdTimerId);
      this.autoAdTimerId = null;
    }
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
}
