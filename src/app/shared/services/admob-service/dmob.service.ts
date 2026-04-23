// src/app/services/admob.service.ts
import { Injectable } from "@angular/core";
import {
  AdMob,
  AdmobConsentStatus,
  AdmobConsentDebugGeography,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
  AdMobBannerSize,
  AdOptions,
  AdLoadInfo,
  InterstitialAdPluginEvents,
  RewardAdOptions,
  RewardAdPluginEvents,
  AdMobRewardItem,
} from "@capacitor-community/admob";
import { StatisticsService } from "../statistics/statistics.service";
import { SubscriptionService } from "../subscription/subscription.service";

@Injectable({ providedIn: "root" })
export class AdmobService {
  // Production Ad IDs (defaults)
  private bannerAdId = ""; // Test banner để debug
  private interAdId = ""; // Test inter để debug
  private rewardAdId = ""; // Test reward để debug
  private appOpenAdId = ""; // App open ad khi app launch

  // Test Ad IDs (fallback khi production không có fill)
  private readonly TEST_BANNER = "ca-app-pub-3940256099942544/6300978111";
  private readonly TEST_INTER = "ca-app-pub-3940256099942544/1033173712";
  private readonly TEST_REWARD = "ca-app-pub-3940256099942544/5224354917";
  private readonly TEST_APP_OPEN = "ca-app-pub-3940256099942544/5662855259"; // Test app open ad ID

  private rewardedAdReady = false;
  private listenersInitialized = false;
  private useTestAds = false; // Fallback to test ads khi production no fill
  private lastAdShowTime: number = 0; // Thời gian lần cuối show quảng cáo
  adsRequiredPerDay: number = 5; // Lấy từ Firebase config

  // Promise resolver để đợi ad dismissed
  private rewardedDismissedResolver: (() => void) | null = null;

  constructor(
    private statisticsService: StatisticsService,
    private subscriptionService: SubscriptionService,
  ) {}

  /**
   * Set Ad IDs from Firebase Config
   * Should be called from AppComponent after getting Firebase config
   */
  setAdIds(bannerAds: string, interstitialAds: string, rewardAds: string, appOpenAds?: string): void {
        if (bannerAds && bannerAds.trim()) {
      this.bannerAdId = bannerAds;
    } else {
    }

    if (interstitialAds && interstitialAds.trim()) {
      this.interAdId = interstitialAds;
    } else {
    }

    if (rewardAds && rewardAds.trim()) {
      this.rewardAdId = rewardAds;
    } else {
    }

    if (appOpenAds && appOpenAds.trim()) {
      this.appOpenAdId = appOpenAds;
    } else {
    }
  }

  /**
   * Set ads required per day from Firebase Config
   * Should be called from AppComponent after getting Firebase config
   */
  setAdsRequiredPerDay(value: number): void {
    this.adsRequiredPerDay = value || 5;
  }

  async init() {
    try {
      // Khởi tạo SDK
      await AdMob.initialize();

      // Setup listeners một lần duy nhất
      this.setupListeners();

      // Xin Tracking (iOS) & cập nhật consent (UMP)
      await this.requestConsent();
    } catch (error: any) {
      throw error;
    }
  }

  private setupListeners() {
    if (this.listenersInitialized) return;

    // Rewarded ad listeners
    AdMob.addListener(RewardAdPluginEvents.Loaded, (i: AdLoadInfo) => {
      this.rewardedAdReady = true;
    });

    AdMob.addListener(RewardAdPluginEvents.Rewarded, (r: AdMobRewardItem) => {
      // Cập nhật thống kê
      this.statisticsService.incrementAdsPlayed();
      const currentStats = this.statisticsService.getTodayStats();
    });

    AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error: any) => {
      this.rewardedAdReady = false;
    });

    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      this.rewardedAdReady = false;

      // Resolve promise nếu đang chờ
      if (this.rewardedDismissedResolver) {
        this.rewardedDismissedResolver();
        this.rewardedDismissedResolver = null;
      }
    });

    // Interstitial listeners
    AdMob.addListener(InterstitialAdPluginEvents.Loaded, (i: AdLoadInfo) => {});

    this.listenersInitialized = true;
  }

  private async requestConsent() {
    // Nếu test trên thiết bị thật ở EU, set debugGeography + deviceId
    const info = await AdMob.requestConsentInfo({
      // debugGeography: AdmobConsentDebugGeography.EEA,
      // testDeviceIdentifiers: ['YOUR_DEVICE_ID'],
    });
    // Nếu bắt buộc hiển thị form consent
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      await AdMob.showConsentForm();
    }
  }

  /* -------- Banner -------- */
  async showBanner(atBottom = true) {
    // 🚫 Skip banner for premium users
    try {
      if (this.subscriptionService.isVipUser()) {
        return;
      }
    } catch (vipCheckError) {
    }

    try {
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {});

      const adId = this.useTestAds ? this.TEST_BANNER : this.bannerAdId;

      const opts: BannerAdOptions = {
        adId: adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: atBottom ? BannerAdPosition.BOTTOM_CENTER : BannerAdPosition.TOP_CENTER,
        margin: 0,
        isTesting: this.useTestAds,
      };

      await AdMob.showBanner(opts);
    } catch (error: any) {

      // Check if it's a "plugin not implemented" error
      const isPluginNotImpl = error?.message?.includes("not implemented") || error?.code === "UNIMPLEMENTED";
      if (isPluginNotImpl) {
        return;
      }

      // Nếu lỗi "No fill" và chưa dùng test ads, thử lại với test ads
      if (error?.code === 3 && !this.useTestAds) {
        this.useTestAds = true;
        await this.showBanner(atBottom); // Retry with test ads
      }
    }
  }

  async hideBanner() {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  }

  /* ----- Interstitial (full-screen) ----- */
  async preloadInterstitial() {
    // 🚫 Skip loading interstitial for premium users
    if (this.subscriptionService.isVipUser()) {
      return;
    }

    try {
      const adId = this.useTestAds ? this.TEST_INTER : this.interAdId;

      const opts: AdOptions = {
        adId: adId,
        isTesting: this.useTestAds,
      };

      await AdMob.prepareInterstitial(opts);
    } catch (error: any) {

      // Check if it's a "plugin not implemented" error
      const isPluginNotImpl = error?.message?.includes("not implemented") || error?.code === "UNIMPLEMENTED";
      if (isPluginNotImpl) {
        return;
      }

      // Nếu lỗi "No fill" và chưa dùng test ads, thử lại với test ads
      if (error?.code === 3 && !this.useTestAds) {
        this.useTestAds = true;
        await this.preloadInterstitial(); // Retry with test ads
      }
    }
  }

  async showInterstitial() {
    // 🚫 Skip interstitial for premium users
    if (this.subscriptionService.isVipUser()) {
      return;
    }

    try {
      await AdMob.showInterstitial();
      // Nạp lại cho lần sau
      await this.preloadInterstitial();
    } catch (error: any) {
    }
  }

  /* -------- App Open Ads -------- */
  async showAppOpenAd() {
    try {
      if (!this.appOpenAdId) {
        return;
      }

      // 🚫 Skip for premium users
      if (this.subscriptionService.isVipUser()) {
        return;
      }

      const adId = this.useTestAds ? this.TEST_APP_OPEN : this.appOpenAdId;

      // TODO: Implement app open ads using capacitor-admob-ads
      // App open ads support to be configured with the new plugin
      return;
    } catch (error: any) {

      // Fallback to test ads on error
      if (!this.useTestAds) {
        this.useTestAds = true;
        await this.showAppOpenAd();
      }
    }
  }

  /* -------- Rewarded -------- */
  async preloadRewarded() {
    // 🚫 Skip loading rewarded ads for premium users
    if (this.subscriptionService.isVipUser()) {
      this.rewardedAdReady = false;
      return;
    }

    try {
      this.rewardedAdReady = false;

      const adId = this.useTestAds ? this.TEST_REWARD : this.rewardAdId;

      const opts: RewardAdOptions = {
        adId: adId,
        isTesting: this.useTestAds,
      };

      await AdMob.prepareRewardVideoAd(opts);
    } catch (error: any) {
      this.rewardedAdReady = false;

      // Nếu lỗi "No fill" và chưa dùng test ads, thử lại với test ads
      if (error?.code === 3 && !this.useTestAds) {
        this.useTestAds = true;
        await this.preloadRewarded(); // Retry with test ads
      }
    }
  }

  async showRewarded(): Promise<AdMobRewardItem | null> {
    // 🚫 Block rewarded ads for premium users
    if (this.subscriptionService.isVipUser()) {
      return null;
    }

    try {
      if (!this.rewardedAdReady) {
        return null;
      }

      // Tạo promise để đợi ad dismissed
      const dismissedPromise = new Promise<void>((resolve) => {
        this.rewardedDismissedResolver = resolve;
      });

      const reward: AdMobRewardItem = await AdMob.showRewardVideoAd();

      // Đợi user dismiss ad
      await dismissedPromise;

      // Nạp lại cho lần sau
      this.rewardedAdReady = false;
      await this.preloadRewarded();

      return reward ?? null;
    } catch (e) {
      this.rewardedAdReady = false;

      // Cleanup resolver nếu có lỗi
      if (this.rewardedDismissedResolver) {
        this.rewardedDismissedResolver();
        this.rewardedDismissedResolver = null;
      }

      return null;
    }
  }

  /**
   * Kiểm tra và hiển thị quảng cáo reward nếu chưa xem đủ số lần trong ngày
   * Enforce 5 minute cooldown giữa các lần show quảng cáo
   * Free users: rewarded ads required for daily quota
   * Premium users: optional (allow but not required)
   * @returns Promise<boolean> - true nếu đã hiển thị quảng cáo, false nếu không
   */
  async checkAndShowRewardAd(): Promise<boolean> {
    try {
      const todayStats = this.statisticsService.getTodayStats();
      const adsRequiredPerDay = this.adsRequiredPerDay;
      const isPremium = this.subscriptionService.isVipUser();
      const AD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
      const timeSinceLastAd = Date.now() - this.lastAdShowTime;

      // 💎 Premium users: optional ads (for bonuses). Don't require daily quota
      if (isPremium) {
        return false;
      }

      // 🆓 Free users: must watch ads to meet daily quota
      if (todayStats.adsPlayed < adsRequiredPerDay) {
        // Kiểm tra cooldown: phải đợi 5 phút sau lần show quảng cáo cuối cùng
        if (timeSinceLastAd < AD_COOLDOWN_MS) {
          const waitTime = Math.ceil((AD_COOLDOWN_MS - timeSinceLastAd) / 1000);
          return false;
        }

        // Preload quảng cáo reward
        await this.preloadRewarded();

        // Đợi ad load xong (tối đa 5 giây)
        const maxWait = 5000; // 5 seconds
        const startTime = Date.now();

        while (!this.rewardedAdReady && Date.now() - startTime < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!this.rewardedAdReady) {
          return false;
        }

        // Hiển thị quảng cáo
        const reward = await this.showRewarded();

        // Cập nhật lastAdShowTime nếu quảng cáo được show thành công
        if (reward !== null) {
          this.lastAdShowTime = Date.now();
        }

        return reward !== null;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Enable test ads mode manually
   */
  enableTestAds() {
    this.useTestAds = true;
  }

  /**
   * Helper: Get current ad mode status
   */
  getAdStatus() {
    return {
      useTestAds: this.useTestAds,
      rewardedAdReady: this.rewardedAdReady,
      bannerAdId: this.useTestAds ? this.TEST_BANNER : this.bannerAdId,
      interAdId: this.useTestAds ? this.TEST_INTER : this.interAdId,
      rewardAdId: this.useTestAds ? this.TEST_REWARD : this.rewardAdId,
    };
  }
}
