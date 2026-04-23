import { Injectable, NgZone } from "@angular/core";
import { Platform } from "@ionic/angular";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { SettingsService, SubscriptionInfo } from "../settings/settings.service";
import { SubscriptionService } from "../subscription/subscription.service";

/**
 * Billing Service using RevenueCat
 * Handles subscription purchases via Purchases SDK
 * Supports multiple subscription packages (1 month, 3 months, 1 year)
 */
@Injectable({
  providedIn: "root",
})
export class BillingService {
  private isInitialized = false;
  private revenuecat_api_key: string = "";

  // RevenueCat Package IDs (not Product IDs!)
  // Package IDs are like: $rc_monthly, $rc_three_month, $rc_annual
  private PRODUCT_IDS = {
    MONTHLY: "$rc_monthly",        // RevenueCat internal package ID
    QUARTERLY: "$rc_three_month",  // RevenueCat internal package ID
    YEARLY: "$rc_annual",          // RevenueCat internal package ID
  };

  // Price mapping for each package (in VND)
  private PRICE_MAP = {
    "$rc_monthly": 29000,
    "$rc_three_month": 69000,
    "$rc_annual": 228000,
  };

  private ALL_PRODUCTS = Object.values(this.PRODUCT_IDS);

  constructor(
    private platform: Platform,
    private settingsService: SettingsService,
    private subscriptionService: SubscriptionService,
    private ngZone: NgZone,
  ) {}

  /**
   * Set RevenueCat API Key from Firebase Config
   */
  setApiKey(apiKey: string): void {
    if (apiKey && apiKey.trim()) {
      this.revenuecat_api_key = apiKey;
    }
  }

  /**
   * Set Product IDs from Firebase Config
   */
  setProductIds(monthlyId: string, quarterlyId: string, yearlyId: string): void {
    if (monthlyId && monthlyId.trim()) {
      this.PRODUCT_IDS.MONTHLY = monthlyId;
    }
    if (quarterlyId && quarterlyId.trim()) {
      this.PRODUCT_IDS.QUARTERLY = quarterlyId;
    }
    if (yearlyId && yearlyId.trim()) {
      this.PRODUCT_IDS.YEARLY = yearlyId;
    }
    this.ALL_PRODUCTS = Object.values(this.PRODUCT_IDS);
  }

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(): Promise<void> {

    if (this.isInitialized) {
      return;
    }

    try {
      // Check if API key is set
      if (!this.revenuecat_api_key) {
        return;
      }

      // Initialize RevenueCat SDK

      await Purchases.configure({
        apiKey: this.revenuecat_api_key,
      });

      // Load customer info
      try {
        await this.checkSubscriptionStatus();
      } catch (error: any) {
        // Don't block initialization for subscription check failure
      }

      this.isInitialized = true;
    } catch (error: any) {
    }
  }

  /**
   * Get available packages/offerings
   */
  async getPackages(): Promise<any[]> {
    try {

      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        return [];
      }

      // Debug: Log all available packages from RevenueCat
      for (const pkg of offerings.current.availablePackages) {
      }

      // Debug: Log expected product IDs

      // Filter to only our product IDs
      const filtered = offerings.current.availablePackages.filter((pkg) => this.ALL_PRODUCTS.includes(pkg.identifier));

      for (const pkg of filtered) {
      }

      return filtered;
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchaseSubscription(productId: string): Promise<boolean> {

    try {
      // Check if product ID is valid
      if (!this.ALL_PRODUCTS.includes(productId)) {
        return false;
      }

      // Get offerings
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        return false;
      }

      // Debug: Log all available packages
      for (const pkg of offerings.current.availablePackages) {
      }

      // Find the package
      let targetPackage = null;
      for (const pkg of offerings.current.availablePackages) {
        if (pkg.identifier === productId) {
          targetPackage = pkg;
          break;
        }
      }

      if (!targetPackage) {
        return false;
      }

      // Perform purchase
      const purchaseResult = await Purchases.purchasePackage({
        aPackage: targetPackage,
      });

      // Update subscription state
      await this.updateSubscriptionState(purchaseResult.customerInfo);

      return true;
    } catch (error: any) {
      if (error.userCancelled) {
      } else {
      }
      return false;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<boolean> {
    try {

      const customerInfo = await Purchases.restorePurchases();

      await this.updateSubscriptionState(customerInfo);

      return this.hasActiveSubscription();
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Update subscription state from customer info
   */
  private async updateSubscriptionState(customerInfo: any): Promise<void> {
    try {

      // Check if customerInfo is valid - handle nested structure
      let info = customerInfo;
      
      // RevenueCat SDK returns wrapped in .customerInfo property
      if (customerInfo?.customerInfo) {
        info = customerInfo.customerInfo;
      }

      if (!info || !info.entitlements) {
        this.settingsService.setSubscription({ isActive: false });
        this.subscriptionService.setVip(false);
        return;
      }

      const entitlements = info.entitlements.active;
      const hasEntitlements = Object.keys(entitlements).length > 0;

      if (hasEntitlements) {
        // Find the first active entitlement
        for (const [entitlementKey, entitlement] of Object.entries(entitlements) as any[]) {

          const subscriptionInfo: SubscriptionInfo = {
            isActive: true,
            plan: this.getPlanName(entitlement.productIdentifier),
            price: (this.PRICE_MAP as any)[entitlement.productIdentifier] || 0,
            expiryDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : undefined,
          };

          this.settingsService.setSubscription(subscriptionInfo);
          this.subscriptionService.setVip(true);

          break; // Only process first entitlement
        }
      } else {
        this.settingsService.setSubscription({ isActive: false });
        this.subscriptionService.setVip(false);
      }

    } catch (error: any) {
    }
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription(): boolean {
    try {
      const info = this.settingsService.getSubscriptionInfo();
      return info?.isActive === true;
    } catch {
      return false;
    }
  }

  /**
   * Get subscription expiry date
   */
  getSubscriptionExpiryDate(): Date | null {
    try {
      const info = this.settingsService.getSubscriptionInfo();
      return info?.expiryDate || null;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Get plan name from product ID
   */
  private getPlanName(productId: string): string {
    switch (productId) {
      case this.PRODUCT_IDS.MONTHLY:
        return "1 Tháng";
      case this.PRODUCT_IDS.QUARTERLY:
        return "3 Tháng";
      case this.PRODUCT_IDS.YEARLY:
        return "1 Năm";
      default:
        return "Subscription";
    }
  }

  /**
   * Refresh subscription status
   */
  async checkSubscriptionStatus(): Promise<void> {
    try {

      const customerInfo = await Purchases.getCustomerInfo();
      await this.updateSubscriptionState(customerInfo);
    } catch (error: any) {
    }
  }

  /**
   * Get diagnostics for debugging
   */
  getDiagnostics(): any {
    try {
      const info = this.settingsService.getSubscriptionInfo();
      return {
        isInitialized: this.isInitialized,
        apiKeySet: !!this.revenuecat_api_key,
        productIDs: this.ALL_PRODUCTS,
        hasActiveSubscription: this.hasActiveSubscription(),
        subscriptionInfo: info,
      };
    } catch {
      return {
        isInitialized: this.isInitialized,
        apiKeySet: !!this.revenuecat_api_key,
        productIDs: this.ALL_PRODUCTS,
        hasActiveSubscription: false,
        subscriptionInfo: null,
      };
    }
  }

  /**
   * Log diagnostic info
   */
  logStoreState(): void {
    try {
      const info = this.settingsService.getSubscriptionInfo();
    } catch {
    }
  }

  /**
   * Debug purchase flow
   */
  async debugPurchaseFlow(): Promise<void> {

    try {
      const packages = await this.getPackages();

      const info = this.settingsService.getSubscriptionInfo();
    } catch (error: any) {
    }

  }

  /**
   * Manage subscriptions - Opens subscription management page
   * User can cancel subscription from Google Play or App Store
   */
  async manageSubscriptions(): Promise<void> {
    try {
      
      if (!this.platform.is("capacitor") && !this.platform.is("cordova")) {
        throw new Error("Not on mobile platform");
      }

      const packageName = "com.siva.packtrack"; // App package name
      const subscriptionsUrl = `https://play.google.com/store/account/subscriptions?package=${packageName}`;

      // Use window.open to open subscription management page
      // On Cordova/Capacitor, this will open in the system browser
      window.open(subscriptionsUrl, "_system");
      
    } catch (error: any) {
      throw error;
    }
  }
}
