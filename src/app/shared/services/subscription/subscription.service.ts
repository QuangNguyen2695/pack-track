import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

/**
 * SubscriptionService
 * Manages user subscription/Vip status
 * Controls whether ads should be shown based on subscription tier
 */
@Injectable({ providedIn: "root" })
export class SubscriptionService {
  // Track Vip status as observable for reactive updates
  private isVipSubject = new BehaviorSubject<boolean>(false);
  public isVip$: Observable<boolean> = this.isVipSubject.asObservable();

  constructor() {
    this.loadVipStatus();
  }

  /**
   * Load Vip status from storage/backend
   * Priority: Server > RevenueCat > Local Storage
   */
  private loadVipStatus() {
    try {
      // TODO: In production, fetch from server or RevenueCat SDK
      const stored = localStorage.getItem("user_Vip_status");
      if (stored) {
        const isVip = JSON.parse(stored);
        this.isVipSubject.next(isVip);
      }
    } catch (error) {
      this.isVipSubject.next(false);
    }
  }

  /**
   * Check if user has Vip subscription
   * @returns true if user is Vip, false otherwise
   */
  isVipUser(): boolean {
    return this.isVipSubject.value;
  }

  /**
   * Set Vip status (called after successful subscription or from backend)
   * @param value - true for Vip, false for free user
   */
  setVip(value: boolean) {
    this.isVipSubject.next(value);
    try {
      localStorage.setItem("user_Vip_status", JSON.stringify(value));
    } catch (error) {
    }
  }

  /**
   * Get Vip status as observable (for reactive components)
   * @returns Observable<boolean>
   */
  getVipStatus$(): Observable<boolean> {
    return this.isVip$;
  }

  /**
   * Clear subscription (called on logout or app reset)
   */
  clearSubscription() {
    this.isVipSubject.next(false);
    try {
      localStorage.removeItem("user_Vip_status");
    } catch (error) {
    }
  }

  /**
   * Get subscription details (extensible for future use)
   */
  getSubscriptionDetails() {
    return {
      isVip: this.isVipUser(),
      paidDate: localStorage.getItem("subscription_date") || null,
      expiryDate: localStorage.getItem("subscription_expiry") || null,
    };
  }
}
