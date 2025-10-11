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
import { AuthService } from "../auth-service/auth.service";
import { RequestAuthRescue } from "@rsApp/modules/auth-access/model/auth.model";
import { CredentialService } from "../credential-service/credential.service";

@Injectable({ providedIn: "root" })
export class AdmobService {
  // ID TEST của Google (dùng khi dev)
  private readonly TEST_BANNER = "ca-app-pub-3940256099942544/6300978111";
  private readonly TEST_INTER = "ca-app-pub-3940256099942544/1033173712";

  private readonly TEST_REWARD = "ca-app-pub-6309992945013997/1410019358";

  constructor(private authService: AuthService, private credentialService: CredentialService) {}

  async init() {
    // Khởi tạo SDK
    await AdMob.initialize();

    // Xin Tracking (iOS) & cập nhật consent (UMP)
    await this.requestConsent();
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
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      console.log("Banner size", size);
    });

    const opts: BannerAdOptions = {
      adId: this.TEST_BANNER,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: atBottom ? BannerAdPosition.BOTTOM_CENTER : BannerAdPosition.TOP_CENTER,
      margin: 0,
      // isTesting: true, // tuỳ chọn
      // npa: true,       // non-personalized ads nếu cần
    };
    await AdMob.showBanner(opts);
  }

  async hideBanner() {
    await AdMob.hideBanner();
    await AdMob.removeBanner();
  }

  /* ----- Interstitial (full-screen) ----- */
  async preloadInterstitial() {
    const opts: AdOptions = { adId: this.TEST_INTER /*, isTesting: true */ };
    AdMob.addListener(InterstitialAdPluginEvents.Loaded, (i: AdLoadInfo) => {
      console.log("Interstitial loaded", i);
    });
    await AdMob.prepareInterstitial(opts);
  }

  async showInterstitial() {
    try {
      await AdMob.showInterstitial();
      // Nạp lại cho lần sau
      await this.preloadInterstitial();
    } catch (e) {
      console.warn("showInterstitial error", e);
    }
  }

  /* -------- Rewarded -------- */
  async preloadRewarded() {
    const opts: RewardAdOptions = { adId: this.TEST_REWARD /*, isTesting: true */ };
    AdMob.addListener(RewardAdPluginEvents.Loaded, (i: AdLoadInfo) => {
      console.log("Rewarded loaded", i);
    });
    AdMob.addListener(RewardAdPluginEvents.Rewarded, (r: AdMobRewardItem) => {
      console.log("User rewarded", r);
    });
    await AdMob.prepareRewardVideoAd(opts);
  }

  async showRewarded(): Promise<AdMobRewardItem | null> {
    try {
      const reward: AdMobRewardItem = await AdMob.showRewardVideoAd();
      await this.preloadRewarded();
      return reward ?? null;
    } catch (e) {
      console.warn("showRewarded error", e);
      return null;
    }
  }
}
