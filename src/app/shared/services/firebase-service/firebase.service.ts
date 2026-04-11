import { Injectable } from "@angular/core";
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";
import { FirebaseRemoteConfig } from "@capacitor-firebase/remote-config";
import { AppStateService } from "../app-state/app-state.service";

@Injectable({
  providedIn: "root",
})
export class FirebaseService {
  private isInitialized = false;
  private readonly CONFIG_CACHE_KEY = "firebase_config_cache";
  private readonly CONFIG_TIMESTAMP_KEY = "firebase_config_timestamp";
  private readonly CACHE_DURATION_MS = 0; // 2 ngày

  constructor(private appState: AppStateService) {}

  async init() {
    if (this.isInitialized) return;

    try {
      await FirebaseAppCheck.initialize({
        provider: "playIntegrity",
        isTokenAutoRefreshEnabled: true,
      });
      await FirebaseRemoteConfig.setSettings({
        minimumFetchIntervalInSeconds: 2 * 24 * 60 * 60, // 2 ngày
      });

      this.isInitialized = true;
    } catch (err) {
      console.error("❌ [FirebaseService] Init error:", err);
      this.appState.setAppCheckFailed("Ứng dụng không thể xác minh. Vui lòng cập nhật hoặc cài đặt lại từ Google Play Store.");
    }
  }

  async getConfig() {
    try {
      // � Luôn thử fetch từ Firebase
      await FirebaseRemoteConfig.fetchAndActivate();

      // Lấy từng property riêng lẻ từ Firebase
      const admob_banner = await FirebaseRemoteConfig.getString({
        key: "admob_banner",
      });

      const admob_inter = await FirebaseRemoteConfig.getString({
        key: "admob_inter",
      });

      const admob_reward = await FirebaseRemoteConfig.getString({
        key: "admob_reward",
      });

      const admob_nav = await FirebaseRemoteConfig.getString({
        key: "admob_nav",
      });

      const admob_native = await FirebaseRemoteConfig.getString({
        key: "admob_native",
      });

      const admob_app_open = await FirebaseRemoteConfig.getString({
        key: "admob_app_open",
      });

      const revenuecat_api_key = await FirebaseRemoteConfig.getString({
        key: "revenuecat_api_key",
      });

      const product_id_remove_ads_1month = await FirebaseRemoteConfig.getString({
        key: "product_id_remove_ads_1month",
      });

      const product_id_remove_ads_3months = await FirebaseRemoteConfig.getString({
        key: "product_id_remove_ads_3months",
      });

      const product_id_remove_ads_yearly = await FirebaseRemoteConfig.getString({
        key: "product_id_remove_ads_yearly",
      });

      const ads_required_per_day = await FirebaseRemoteConfig.getString({
        key: "ads_required_per_day",
      });

      const affiliate_data = await FirebaseRemoteConfig.getString({
        key: "affiliate_data",
      });

      const momo_acount = await FirebaseRemoteConfig.getString({
        key: "momo_acount",
      });

      const bank_account = await FirebaseRemoteConfig.getString({
        key: "bank_account",
      });

      // 🔍 Lấy cache cũ để compare với Firebase
      const cachedConfig = this.getOldCachedConfig();

      // Xây dựng config, mỗi property check riêng: Firebase → Cache → Empty
      const config = {
        admobBanner: admob_banner.value || cachedConfig?.admobBanner || "",
        admobInter: admob_inter.value || cachedConfig?.admobInter || "",
        admobReward: admob_reward.value || cachedConfig?.admobReward || "",
        admobNav: admob_nav.value || cachedConfig?.admobNav || "",
        admobNative: admob_native.value || cachedConfig?.admobNative || "",
        admobAppOpen: admob_app_open.value || cachedConfig?.admobAppOpen || "",
        revenuecat_api_key: revenuecat_api_key.value || cachedConfig?.revenuecat_api_key || "",
        product_id_remove_ads_1month: product_id_remove_ads_1month.value || cachedConfig?.product_id_remove_ads_1month || "",
        product_id_remove_ads_3months: product_id_remove_ads_3months.value || cachedConfig?.product_id_remove_ads_3months || "",
        product_id_remove_ads_yearly: product_id_remove_ads_yearly.value || cachedConfig?.product_id_remove_ads_yearly || "",
        ads_required_per_day: ads_required_per_day.value || cachedConfig?.ads_required_per_day || "",
        affiliateData: affiliate_data.value || cachedConfig?.affiliateData || "",
        momoAccount: momo_acount.value || cachedConfig?.momoAccount || "",
        bankAccount: bank_account.value || cachedConfig?.bankAccount || "",
      };

      console.log("🔀 [Firebase] Config after merging Firebase + Cache:", config);

      // 💾 Lưu cache nếu có ít nhất 1 property không trống
      if (config.admobBanner || config.admobInter || config.admobReward) {
        this.setCachedConfig(config);
        console.log("💾 [Firebase] Config cached with timestamp");
      }

      console.log("✅ [Firebase] Final config returned:", config);
      return config;
    } catch (err) {
      console.error("❌ [Firebase] Fetch config error:", err);

      // ⚠️ Nếu fetch thất bại, lấy cache cũ
      const oldCache = this.getOldCachedConfig();
      if (oldCache) {
        console.warn("⚠️ [Firebase] Fetch failed, using cache fallback:", oldCache);
        return oldCache;
      }

      return null;
    }
  }

  /**
   * Lưu config vào cache với timestamp
   */
  private setCachedConfig(config: any): void {
    try {
      const timestamp = Date.now();
      localStorage.setItem(this.CONFIG_CACHE_KEY, JSON.stringify(config));
      localStorage.setItem(this.CONFIG_TIMESTAMP_KEY, timestamp.toString());
      console.log(`💾 [Firebase] Config saved to cache at ${new Date(timestamp).toLocaleString()}`);
    } catch (err) {
      console.warn("⚠️ [Firebase] Failed to save cache:", err);
    }
  }

  /**
   * Lấy cache nếu còn hợp lệ (< 2 ngày)
   */
  private getCachedConfig(): any {
    try {
      const cachedConfig = localStorage.getItem(this.CONFIG_CACHE_KEY);
      const timestamp = localStorage.getItem(this.CONFIG_TIMESTAMP_KEY);

      if (!cachedConfig || !timestamp) {
        console.log("📭 [Firebase] No cache found");
        return null;
      }

      const cachedTime = parseInt(timestamp);
      const now = Date.now();
      const ageMs = now - cachedTime;
      const ageHours = Math.round(ageMs / (1000 * 60 * 60));

      if (ageMs < this.CACHE_DURATION_MS) {
        console.log(
          `✅ [Firebase] Cache is valid (${ageHours}h old, expires in ${Math.round((this.CACHE_DURATION_MS - ageMs) / (1000 * 60 * 60))}h)`,
        );
        return JSON.parse(cachedConfig);
      } else {
        console.log(`⏰ [Firebase] Cache expired (${ageHours}h old, max 48h)`);
        return null;
      }
    } catch (err) {
      console.warn("⚠️ [Firebase] Error reading cache:", err);
      return null;
    }
  }

  /**
   * Lấy cache cũ ngược hết hạn (cho fallback khi fetch thất bại)
   */
  private getOldCachedConfig(): any {
    try {
      const cachedConfig = localStorage.getItem(this.CONFIG_CACHE_KEY);
      if (cachedConfig) {
        return JSON.parse(cachedConfig);
      }
    } catch (err) {
      console.warn("⚠️ [Firebase] Error reading old cache:", err);
    }
    return null;
  }
}
