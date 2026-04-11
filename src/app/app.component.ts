import { Component, HostListener, OnInit, ViewChild, ElementRef } from "@angular/core";
import { Platform, ToastController, AlertController, IonRouterOutlet, NavController } from "@ionic/angular";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Router, NavigationStart } from "@angular/router";
import { SyncProgressService } from "./shared/services/sync-progress/sync-progress.service";
import { SettingsService } from "./shared/services/settings/settings.service";
import { Utils } from "./shared/utils/utils";
import { AdmobService } from "./shared/services/admob-service/dmob.service";
import { BillingService } from "./shared/services/billing/billing.service";
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";
import { FirebaseService } from "./shared/services/firebase-service/firebase.service";
import { AppStateService } from "./shared/services/app-state/app-state.service";
import { VideoRecoveryService } from "./shared/services/video-recovery/video-recovery.service";
import { LogCaptureService } from "./shared/services/log-capture/log-capture.service";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { AffiliateService } from "./shared/services/affiliate-service/affiliate.service";
import { toast } from "ngx-sonner";
type SecurityPlugin = {
  checkSignature(): Promise<{ valid: boolean }>;
};

const Security = registerPlugin<SecurityPlugin>("Security");

@Component({
  selector: "app-root",
  templateUrl: "app.component.html",
  styleUrls: ["app.component.scss"],
  standalone: false,
})
export class AppComponent implements OnInit {
  @ViewChild(IonRouterOutlet) routerOutlet!: IonRouterOutlet;

  appCheckFailed = false;
  private appCheckFailedAlert: any;

  // Firebase config properties
  admobBanner: string = "";
  admobInter: string = "";
  admobReward: string = "";
  admobNav: string = "";
  admobAppOpen: string = "";
  revenuecat_api_key: string = "";
  adsRequiredPerDay: number = 5;
  affiliateData: string = "";

  // Flag to prevent duplicate AdMob init
  private admobInitialized = false;

  constructor(
    private platform: Platform,
    public utils: Utils,
    private syncProgressService: SyncProgressService,
    private settingsService: SettingsService,
    private router: Router,
    private ads: AdmobService,
    private firebaseService: FirebaseService,
    private appState: AppStateService,
    private alertController: AlertController,
    private billing: BillingService,
    private videoRecoveryService: VideoRecoveryService,
    private affiliateService: AffiliateService,
    private navController: NavController,
    private logCaptureService: LogCaptureService,
  ) {
    this.initializeApp();
    this.firebaseInit();
    this.watchAppState();

    this.platform.backButton.subscribeWithPriority(10, () => {
      if (this.routerOutlet?.canGoBack()) {
        if (this.appCheckFailed) {
          console.warn("⛔ [AppComponent] Back button blocked - AppCheck has failed");
          return;
        }
        this.routerOutlet.pop();
      } else {
        this.navController.navigateRoot(["/"]);
        // App.exitApp();
      }
    });
  }

  async firebaseInit() {
    if (this.platform.is("capacitor") || this.platform.is("cordova")) {
      try {
        await this.firebaseService.init();

        const config = await this.firebaseService.getConfig();

        if (config) {
          // Assign config values to component properties
          this.admobBanner = config.admobBanner || "";
          this.admobInter = config.admobInter || "";
          this.admobReward = config.admobReward || "";
          this.admobNav = config.admobNav || "";
          this.admobAppOpen = config.admobAppOpen || "";
          this.revenuecat_api_key = config.revenuecat_api_key || "";
          this.adsRequiredPerDay = parseInt(config.ads_required_per_day) || 5;

          this.ads.setAdIds(this.admobBanner, this.admobInter, this.admobReward, this.admobAppOpen);
          this.ads.setAdsRequiredPerDay(this.adsRequiredPerDay);

          // Set RevenueCat API Key in Billing Service
          this.billing.setApiKey(this.revenuecat_api_key);

          // Note: Product IDs/Package IDs are hardcoded in BillingService
          // RevenueCat uses internal package IDs like $rc_monthly which don't change

          // Initialize Billing with RevenueCat
          console.error("[DEBUG] Setting up Billing initialization (RevenueCat)...");

          // Initialize billing immediately (no delay needed with RevenueCat)
          try {
            console.error("[DEBUG] CALLING billing.initialize()...");
            await this.billing.initialize();
            console.error("[DEBUG] ✅ billing.initialize() COMPLETED SUCCESSFULLY");
          } catch (error: any) {
            console.error("[DEBUG] ❌ billing.initialize() THREW ERROR:", error?.message || error);
            console.error(error?.stack);
          }

          // Set Affiliate Data in Affiliate Service
          if (config.affiliateData) {
            this.affiliateService.setAffiliateData(config.affiliateData);
          }

          await this.admobInit();
          console.error("[DEBUG] ✅ firebaseInit() COMPLETED - Firebase config loaded and services initialized");
        } else {
          console.error("[DEBUG] ❌ firebaseInit() - Firebase config is NULL/EMPTY");
          this.appState.setAppCheckFailed("Ứng dụng không thể xác minh. Vui lòng cập nhật hoặc cài đặt lại từ Google Play Store.");
        }
      } catch (error: any) {
        console.error("[DEBUG] ❌ firebaseInit() CAUGHT ERROR:", error?.message || error);
        console.error(error?.stack);
      }
    } else {
    }
  }

  async admobInit() {
    // ✅ Prevent duplicate init
    if (this.admobInitialized) {
      console.warn("⚠️ [AppComponent] AdMob already initialized, skipping...");
      return;
    }
    this.admobInitialized = true;

    try {
      await this.ads.init();
    } catch (error: any) {
      console.error("❌ [AppComponent] AdMob init error:", error?.message || error);
      // Don't block app - continue even if AdMob fails
      return;
    }

    try {
      await this.ads.showBanner(false);
    } catch (error: any) {
      console.error("❌ [AppComponent] showBanner error:", error?.message || error);
    }

    try {
      await this.ads.preloadInterstitial();
    } catch (error) {
      console.error("❌ [AppComponent] preloadInterstitial error:", error);
    }

    try {
      await this.ads.preloadRewarded();
    } catch (error) {
      console.error("❌ [AppComponent] preloadRewarded error:", error);
    }
  }

  /**
   * Watch app state for appCheck failures and show modal if needed
   */
  private watchAppState() {
    this.appState.appState$.subscribe(async (state) => {
      if (state.appCheckFailed) {
        console.error("⚠️ [AppComponent] AppCheck failed, showing forced update modal");
        this.appCheckFailed = true;
        await this.showAppCheckFailedModal(state.appCheckError);
      }
    });
  }

  /**
   * Show modal when appCheck fails
   * This modal cannot be dismissed and requires user to update the app
   */
  private async showAppCheckFailedModal(errorMessage?: string) {
    // Disable all app interaction
    document.body.classList.add("appcheck-failed");
    const ionApp = document.querySelector("ion-app");
    if (ionApp) {
      ionApp.classList.add("appcheck-failed");
    }

    this.appCheckFailedAlert = await this.alertController.create({
      header: "Cập nhật ứng dụng",
      message:
        errorMessage ||
        "Phiên bản ứng dụng này không còn được hỗ trợ. Vui lòng cập nhật hoặc cài đặt lại ứng dụng từ Google Play Store để tiếp tục sử dụng.",
      buttons: [
        {
          text: "Mở Play Store",
          handler: async () => {
            // Open Google Play Store app page
            const storeUrl = "https://play.google.com/store/apps/details?id=safetrack.app";
            window.open(storeUrl, "_system");
            // Delay before closing app - allows user to decide
            setTimeout(() => {
              App.exitApp();
            }, 2000);
          },
        },
      ],
      backdropDismiss: false, // Cannot dismiss by tapping backdrop
      keyboardClose: false, // Don't close when keyboard appears
      cssClass: "app-check-failed-modal", // Custom CSS for styling
    });

    // Prevent all interactions with the app
    const presentingElement = document.querySelector("ion-nav");
    if (presentingElement) {
      (presentingElement as any).style.pointerEvents = "none";
    }

    await this.appCheckFailedAlert.present();

    // Prevent dismiss by any method
    this.appCheckFailedAlert.onWillDismiss().then((result: any) => {
      if (this.appCheckFailed) {
        console.warn("⛔ [AppComponent] Attempt to dismiss blocked - AppCheck failed");
        // Re-present immediately
        setTimeout(() => {
          this.appCheckFailedAlert.present();
        }, 100);
      }
    });
  }

  async ngOnInit() {
    this.checkScreenSize();
    this.checkVipExpiry(); // Check if VIP has expired
  }

  async initializeApp() {
    if (Capacitor.getPlatform() !== "web") {
      try {
        const result = await Security.checkSignature();

        if (!result.valid) {
          this.appState.setAppCheckFailed("Ứng dụng không thể xác minh. Vui lòng cập nhật hoặc cài đặt lại từ Google Play Store.");
        }
      } catch (error) {
        console.warn("⚠️ [AppComponent] Security plugin error (non-critical):", error);
        // Plugin may not be available on all devices/builds - allow app to continue
      }
    }

    if (this.platform.is("cordova") || this.platform.is("capacitor")) {
      // Làm cho thanh status bar trong suốt
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Default });
      StatusBar.setBackgroundColor({ color: "#00000000" });
    } else {
    }

    // Auto-delete old videos khi app khởi động
    this.autoDeleteOldVideos();

    // Recover orphaned videos from device (runs in background)
    this.recoverCachedVideos();
  }

  /**
   * Recover orphaned videos from device media when app is freshly downloaded
   * Runs in background without blocking app initialization
   */
  private async recoverCachedVideos() {
    try {
      // Give app time to fully initialize first
      setTimeout(async () => {
        try {
          const recoveredCount = await this.videoRecoveryService.recoverOrphanedVideos();
          if (recoveredCount > 0) {
          }
        } catch (error) {
          console.error("❌ [AppComponent] Video recovery failed:", error);
        }
      }, 2000);
    } catch (error) {
      console.error("❌ [AppComponent] Failed to start video recovery:", error);
    }
  }

  /**
   * Tự động xóa video cũ theo cài đặt khi app khởi động
   */
  private async autoDeleteOldVideos() {
    try {
      // Delay một chút để app khởi động hoàn toàn trước khi xóa
      // processAutoDelete() sẽ handle việc hiển thị widget nếu có việc xóa
      setTimeout(async () => {
        try {
          await this.syncProgressService.processAutoDelete();
        } catch (error) {
          console.error("❌ [AppComponent] Auto-delete failed:", error);
        }
      }, 1000);
    } catch (error) {
      console.error("❌ [AppComponent] Failed to start auto-delete:", error);
    }
  }

  /**
   * Check if VIP subscription has expired and disable if necessary
   */
  private checkVipExpiry() {
    try {
      const subscriptionInfo = this.settingsService.getSubscriptionInfo();

      if (subscriptionInfo.isActive && subscriptionInfo.expiryDate) {
        const expiryDate = new Date(subscriptionInfo.expiryDate);
        const now = new Date();

        if (now > expiryDate) {
          this.settingsService.disableVip();
        } else {
          const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
    } catch (error) {
      console.warn("⚠️ [AppComponent] Failed to check VIP expiry:", error);
    }
  }

  @HostListener("window:resize", ["$event"])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.utils.isApp = window.innerWidth < 1128;
    this.setScrollbarCss();
  }

  setScrollbarCss() {
    const styleId = "dynamic-scrollbar-style"; // Unique ID for the style element

    if (!this.utils.isApp) {
      // Add styles dynamically
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
                /* width */
                ::-webkit-scrollbar {
                    width: 6px;
                    height: 4px;
                }
    
                /* Track */
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
    
                /* Handle */
                ::-webkit-scrollbar-thumb {
                    background: #888;
                }
    
                /* Handle on hover */
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--primary);
                }
    
                .menu-selected {
                    border-bottom: 2px solid white;
                }
    
                .content-body {
                    .ion-page {
                        display: contents;
                    }
                }
            `;
        document.head.appendChild(style);
      }
    } else {
      // Remove dynamically added styles
      const style = document.getElementById(styleId);
      if (style) {
        style.remove(); // Removes the style element from the document
      }
    }
  }

  getSubUrl(): string {
    const path = window.location.pathname;
    const query = window.location.search;
    return path + query;
  }

  isCurrentSubUrlValid(url: string): boolean {
    const currentSubUrl = this.getSubUrl();
    return url.includes(currentSubUrl);
  }
}
