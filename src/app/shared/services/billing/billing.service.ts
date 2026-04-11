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
      console.error("✅ [Billing] RevenueCat API Key set:", apiKey.substring(0, 20) + "...");
    }
  }

  /**
   * Set Product IDs from Firebase Config
   */
  setProductIds(monthlyId: string, quarterlyId: string, yearlyId: string): void {
    if (monthlyId && monthlyId.trim()) {
      this.PRODUCT_IDS.MONTHLY = monthlyId;
      console.error("✅ [Billing] Monthly Product ID set:", this.PRODUCT_IDS.MONTHLY);
    }
    if (quarterlyId && quarterlyId.trim()) {
      this.PRODUCT_IDS.QUARTERLY = quarterlyId;
      console.error("✅ [Billing] Quarterly Product ID set:", this.PRODUCT_IDS.QUARTERLY);
    }
    if (yearlyId && yearlyId.trim()) {
      this.PRODUCT_IDS.YEARLY = yearlyId;
      console.error("✅ [Billing] Yearly Product ID set:", this.PRODUCT_IDS.YEARLY);
    }
    this.ALL_PRODUCTS = Object.values(this.PRODUCT_IDS);
  }

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(): Promise<void> {
    console.group("🚀 [Billing] INITIALIZATION START - RevenueCat");
    console.error("Timestamp:", new Date().toISOString());

    if (this.isInitialized) {
      console.error("✅ Already initialized - skipping");
      console.groupEnd();
      return;
    }

    try {
      // Check if API key is set
      if (!this.revenuecat_api_key) {
        console.error("❌ RevenueCat API Key not set - cannot initialize");
        console.error("   Make sure to call setApiKey() with Firebase config value");
        console.groupEnd();
        return;
      }

      // Initialize RevenueCat SDK
      console.error("Step 2️⃣ - Configuring RevenueCat SDK...");
      console.error("  └─ API Key:", this.revenuecat_api_key.substring(0, 20) + "...");

      await Purchases.configure({
        apiKey: this.revenuecat_api_key,
      });

      console.error("✅ RevenueCat SDK configured");

      // Load customer info
      console.error("Step 3️⃣ - Loading customer info...");
      try {
        await this.checkSubscriptionStatus();
        console.error("✅ Subscription status checked successfully");
      } catch (error: any) {
        console.error("⚠️ Failed to check subscription (non-blocking):", error?.message || error);
        // Don't block initialization for subscription check failure
      }

      this.isInitialized = true;
      console.error(`✅ [Billing] Initialization COMPLETE`);
      console.error(`   - Products: ${this.ALL_PRODUCTS.length}`);
      console.groupEnd();
    } catch (error: any) {
      console.error("❌ [Billing] Initialization failed:", error?.message || error);
      console.error(error?.stack);
      console.groupEnd();
    }
  }

  /**
   * Get available packages/offerings
   */
  async getPackages(): Promise<any[]> {
    try {
      console.error("🔄 [Billing] Fetching available packages...");

      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.warn("⚠️ [Billing] No current offering available");
        console.error("   Full offerings object:", JSON.stringify(offerings, null, 2));
        return [];
      }

      console.error(`✅ [Billing] Found ${offerings.current.availablePackages.length} packages`);

      // Debug: Log all available packages from RevenueCat
      console.error("   Available packages from RevenueCat:");
      for (const pkg of offerings.current.availablePackages) {
        console.error(`   - ID: ${pkg.identifier}, Title: ${pkg.product?.title || 'N/A'}`);
      }

      // Debug: Log expected product IDs
      console.error(
        `   Expected product IDs: ${this.ALL_PRODUCTS.join(", ")}`,
      );

      // Filter to only our product IDs
      const filtered = offerings.current.availablePackages.filter((pkg) => this.ALL_PRODUCTS.includes(pkg.identifier));

      console.error(`   After filtering: ${filtered.length} matching packages`);

      for (const pkg of filtered) {
        console.error(`   📦 ${pkg.identifier}: ${pkg.product.title} - ${pkg.product.priceString}`);
      }

      return filtered;
    } catch (error: any) {
      console.error("❌ [Billing] Failed to fetch packages:", error?.message || error);
      return [];
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchaseSubscription(productId: string): Promise<boolean> {
    console.group("🛒 [Billing] PURCHASE FLOW START - " + productId);
    console.error("Timestamp:", new Date().toISOString());

    try {
      // Check if product ID is valid
      if (!this.ALL_PRODUCTS.includes(productId)) {
        console.error(`❌ Product not found: ${productId}`);
        console.error(`   Available: ${this.ALL_PRODUCTS.join(", ")}`);
        console.groupEnd();
        return false;
      }

      console.error(`Step 1️⃣ - Getting offerings for ${productId}...`);

      // Get offerings
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.error("❌ No current offering available");
        console.error("   Offerings data:", JSON.stringify(offerings, null, 2));
        console.groupEnd();
        return false;
      }

      // Debug: Log all available packages
      console.error(`   Found ${offerings.current.availablePackages.length} packages:`);
      for (const pkg of offerings.current.availablePackages) {
        console.error(`   - ${pkg.identifier}: ${pkg.product?.title || 'unknown'}`);
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
        console.error(`❌ Package not found: ${productId}`);
        console.error(`   Available packages: ${offerings.current.availablePackages.map((p) => p.identifier).join(", ")}`);
        console.error(`   Product IDs we're looking for: ${this.ALL_PRODUCTS.join(", ")}`);
        console.groupEnd();
        return false;
      }

      console.error(`Step 2️⃣ - Initiating purchase...`);
      console.error(`   Title: ${targetPackage.product.title}`);
      console.error(`   Price: ${targetPackage.product.priceString}`);

      // Perform purchase
      const purchaseResult = await Purchases.purchasePackage({
        aPackage: targetPackage,
      });

      console.error("Step 3️⃣ - Purchase completed");
      console.error("  Customer Info:", purchaseResult.customerInfo);

      // Update subscription state
      await this.updateSubscriptionState(purchaseResult.customerInfo);

      console.error(`✅ [Billing] PURCHASE APPROVED: ${productId}`);
      console.groupEnd();
      return true;
    } catch (error: any) {
      if (error.userCancelled) {
        console.error("🚫 [Billing] PURCHASE CANCELLED BY USER");
      } else {
        console.error("❌ [Billing] PURCHASE ERROR:", error?.message || error);
        console.error(error?.stack);
      }
      console.groupEnd();
      return false;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<boolean> {
    try {
      console.group("🔄 [Billing] RESTORING PURCHASES");
      console.error("Timestamp:", new Date().toISOString());

      const customerInfo = await Purchases.restorePurchases();

      console.error("✅ Purchases restored");
      await this.updateSubscriptionState(customerInfo);

      console.groupEnd();
      return this.hasActiveSubscription();
    } catch (error: any) {
      console.error("❌ [Billing] Restore error:", error?.message || error);
      console.groupEnd();
      return false;
    }
  }

  /**
   * Update subscription state from customer info
   */
  private async updateSubscriptionState(customerInfo: any): Promise<void> {
    try {
      console.group("📊 [Billing] UPDATING SUBSCRIPTION STATE");

      // Check if customerInfo is valid - handle nested structure
      let info = customerInfo;
      
      // RevenueCat SDK returns wrapped in .customerInfo property
      if (customerInfo?.customerInfo) {
        info = customerInfo.customerInfo;
        console.error("   ℹ️ CustomerInfo was nested, unwrapped");
      }

      if (!info || !info.entitlements) {
        console.error("⚠️ No customer info available or info.entitlements is null");
        console.error("   Info:", JSON.stringify(customerInfo).substring(0, 200) + "...");
        this.settingsService.setSubscription({ isActive: false });
        this.subscriptionService.setVip(false);
        console.groupEnd();
        return;
      }

      const entitlements = info.entitlements.active;
      const hasEntitlements = Object.keys(entitlements).length > 0;

      if (hasEntitlements) {
        // Find the first active entitlement
        for (const [entitlementKey, entitlement] of Object.entries(entitlements) as any[]) {
          console.error("✅ Active entitlement found:", entitlementKey);
          console.error("   Product ID:", entitlement.productIdentifier);
          console.error("   Expiry Date:", entitlement.expirationDate);

          const subscriptionInfo: SubscriptionInfo = {
            isActive: true,
            plan: this.getPlanName(entitlement.productIdentifier),
            price: (this.PRICE_MAP as any)[entitlement.productIdentifier] || 0,
            expiryDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : undefined,
          };

          this.settingsService.setSubscription(subscriptionInfo);
          this.subscriptionService.setVip(true);

          console.error("💾 [Billing] Subscription updated");
          break; // Only process first entitlement
        }
      } else {
        console.error("⚠️ No active entitlements");
        this.settingsService.setSubscription({ isActive: false });
        this.subscriptionService.setVip(false);
      }

      console.groupEnd();
    } catch (error: any) {
      console.error("❌ Failed to update subscription state:", error?.message || error);
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
      console.error("🔄 [Billing] Checking subscription status...");

      const customerInfo = await Purchases.getCustomerInfo();
      await this.updateSubscriptionState(customerInfo);
    } catch (error: any) {
      console.error("❌ Failed to check subscription:", error?.message || error);
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
    console.group("📊 [Billing] STORE STATE DIAGNOSTICS");
    console.error("Initialized:", this.isInitialized);
    console.error("API Key Set:", !!this.revenuecat_api_key);
    console.error("Products:", this.ALL_PRODUCTS);
    try {
      const info = this.settingsService.getSubscriptionInfo();
      console.error("Subscription Info:", info);
    } catch {
      console.error("Subscription Info: (error reading)");
    }
    console.groupEnd();
  }

  /**
   * Debug purchase flow
   */
  async debugPurchaseFlow(): Promise<void> {
    console.group("🐛 [Billing] DEBUG PURCHASE FLOW");

    try {
      const packages = await this.getPackages();
      console.error(
        "Available packages:",
        packages.map((p) => p.identifier),
      );

      const info = this.settingsService.getSubscriptionInfo();
      console.error("Subscription info:", info);
      console.error("Has active:", this.hasActiveSubscription());
    } catch (error: any) {
      console.error("Error:", error?.message || error);
    }

    console.groupEnd();
  }

  /**
   * Manage subscriptions - Opens subscription management page
   * User can cancel subscription from Google Play or App Store
   */
  async manageSubscriptions(): Promise<void> {
    try {
      console.group("🔗 [Billing] OPENING SUBSCRIPTION MANAGEMENT");
      
      if (!this.platform.is("capacitor") && !this.platform.is("cordova")) {
        throw new Error("Not on mobile platform");
      }

      const packageName = "com.siva.packtrack"; // App package name
      const subscriptionsUrl = `https://play.google.com/store/account/subscriptions?package=${packageName}`;

      // Use window.open to open subscription management page
      // On Cordova/Capacitor, this will open in the system browser
      window.open(subscriptionsUrl, "_system");
      
      console.log("✅ Opened subscription management");
      console.groupEnd();
    } catch (error: any) {
      console.error("❌ Failed to open subscription management:", error?.message || error);
      console.groupEnd();
      throw error;
    }
  }
}
