import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

export interface SubscriptionInfo {
  isActive: boolean;
  plan?: string; // "1 Tháng" | "3 Tháng" | "1 Năm"
  startDate?: Date;
  expiryDate?: Date;
  price?: number;
  cancelledDate?: Date; // Date when user cancelled (still has access until expiryDate)
  status?: "active" | "pending_cancel"; // active = normal, pending_cancel = cancelled but still has access
}

export interface SettingsPreferences {
  autoDeleteVideosAfterDays: number | null; // null = disabled, 30/15/7
  notificationsEnabled: boolean;
  userType: "seller" | "buyer"; // 'seller' = person selling, 'buyer' = person buying (default: seller)
}

/**
 * SettingsService
 * Manages user subscription info and preferences (auto-delete videos, notifications, etc.)
 */
@Injectable({ providedIn: "root" })
export class SettingsService {
  private subscriptionInfoSubject = new BehaviorSubject<SubscriptionInfo>({
    isActive: false,
  });
  public subscriptionInfo$: Observable<SubscriptionInfo> = this.subscriptionInfoSubject.asObservable();

  private settingsSubject = new BehaviorSubject<SettingsPreferences>({
    autoDeleteVideosAfterDays: null,
    notificationsEnabled: true,
    userType: "seller", // Default to seller
  });
  public settings$: Observable<SettingsPreferences> = this.settingsSubject.asObservable();

  constructor() {
    this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings() {
    try {
      const savedSettings = localStorage.getItem("user_settings");
      const savedSubscription = localStorage.getItem("subscription_info");

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        this.settingsSubject.next(settings);
      }

      if (savedSubscription) {
        const subscription = JSON.parse(savedSubscription);
        if (subscription.startDate) subscription.startDate = new Date(subscription.startDate);
        if (subscription.expiryDate) subscription.expiryDate = new Date(subscription.expiryDate);
        this.subscriptionInfoSubject.next(subscription);
      }
    } catch (error) {
    }
  }

  /**
   * Set subscription info (called after successful purchase)
   */
  setSubscription(info: SubscriptionInfo) {
    this.subscriptionInfoSubject.next(info);
    try {
      localStorage.setItem("subscription_info", JSON.stringify(info));
    } catch (error) {
    }
  }

  /**
   * Get current subscription info
   */
  getSubscriptionInfo(): SubscriptionInfo {
    return this.subscriptionInfoSubject.value;
  }

  /**
   * Cancel subscription - user keeps access until expiryDate
   * Then need to renew if want to continue using VIP
   */
  cancelSubscription() {
    const current = this.getSubscriptionInfo();
    const canceled: SubscriptionInfo = {
      ...current,
      status: "pending_cancel",
      cancelledDate: new Date(),
      isActive: true, // Still active until expiryDate
    };
    this.subscriptionInfoSubject.next(canceled);
    try {
      localStorage.setItem("subscription_info", JSON.stringify(canceled));
    } catch (error) {
    }
  }

  /**
   * Check if subscription has been cancelled (pending_cancel status)
   */
  isPendingCancellation(): boolean {
    return this.getSubscriptionInfo().status === "pending_cancel";
  }

  /**
   * Disable VIP access immediately (called when expiry date is reached)
   */
  disableVip() {
    const disabled: SubscriptionInfo = {
      isActive: false,
      status: "active",
    };
    this.subscriptionInfoSubject.next(disabled);
    try {
      localStorage.setItem("subscription_info", JSON.stringify(disabled));
    } catch (error) {
    }
  }

  /**
   * Update auto-delete video preference
   */
  setAutoDeleteVideosAfterDays(days: number | null) {
    const current = this.settingsSubject.value;
    const updated: SettingsPreferences = {
      ...current,
      autoDeleteVideosAfterDays: days,
    };
    this.settingsSubject.next(updated);
    try {
      localStorage.setItem("user_settings", JSON.stringify(updated));
    } catch (error) {
    }
  }

  /**
   * Update notifications preference
   */
  setNotificationsEnabled(enabled: boolean) {
    const current = this.settingsSubject.value;
    const updated: SettingsPreferences = {
      ...current,
      notificationsEnabled: enabled,
    };
    this.settingsSubject.next(updated);
    try {
      localStorage.setItem("user_settings", JSON.stringify(updated));
    } catch (error) {
    }
  }

  /**
   * Set user type (seller or buyer)
   */
  setUserType(type: "seller" | "buyer") {
    const current = this.settingsSubject.value;
    const updated: SettingsPreferences = {
      ...current,
      userType: type,
    };
    this.settingsSubject.next(updated);
    try {
      localStorage.setItem("user_settings", JSON.stringify(updated));
    } catch (error) {
    }
  }

  /**
   * Get current settings
   */
  getSettings(): SettingsPreferences {
    return this.settingsSubject.value;
  }

  /**
   * Calculate days remaining for subscription
   */
  getDaysRemaining(): number | null {
    const subscription = this.getSubscriptionInfo();
    if (!subscription.isActive || !subscription.expiryDate) {
      return null;
    }
    const today = new Date();
    const expiry = new Date(subscription.expiryDate);
    const diff = expiry.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if subscription is expired
   */
  isSubscriptionExpired(): boolean {
    const subscription = this.getSubscriptionInfo();
    if (!subscription.expiryDate) return true;
    return new Date() > new Date(subscription.expiryDate);
  }
}
