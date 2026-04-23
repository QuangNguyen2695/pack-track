import { Injectable } from "@angular/core";
import { AffiliateItem, AffiliateDataConfig } from "./affiliate.model";

@Injectable({
  providedIn: "root",
})
export class AffiliateService {
  private affiliateData: AffiliateDataConfig | null = null;
  private readonly CACHE_KEY = "affiliate_data_cache";
  private readonly CACHE_TIMESTAMP_KEY = "affiliate_data_timestamp";
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Try to load from cache on init
    this.loadFromCache();
  }

  /**
   * Set affiliate data from AppComponent (after fetching from Firebase)
   * Should be called from AppComponent after getting Firebase config
   */
  setAffiliateData(dataStr: string): void {
    if (dataStr && dataStr.trim()) {
      this.parseAndCacheData(dataStr);
    } else {
    }
  }

  /**
   * Parse affiliate data and cache it
   */
  private parseAndCacheData(dataStr: string): void {
    try {
      const parsed = JSON.parse(dataStr) as AffiliateDataConfig;

      if (parsed && Array.isArray(parsed.items)) {
        this.affiliateData = parsed;
        this.saveToCache(parsed);
      } else {
      }
    } catch (error) {
    }
  }

  /**
   * Save affiliate data to local cache
   */
  private saveToCache(data: AffiliateDataConfig): void {
    try {
      const timestamp = Date.now();
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(this.CACHE_TIMESTAMP_KEY, timestamp.toString());
    } catch (err) {
    }
  }

  /**
   * Load affiliate data from local cache if valid
   */
  private loadFromCache(): void {
    try {
      const cachedData = localStorage.getItem(this.CACHE_KEY);
      const timestamp = localStorage.getItem(this.CACHE_TIMESTAMP_KEY);

      if (!cachedData || !timestamp) {
        return;
      }

      const cachedTime = parseInt(timestamp);
      const now = Date.now();
      const ageMs = now - cachedTime;

      if (ageMs < this.CACHE_DURATION_MS) {
        const parsed = JSON.parse(cachedData) as AffiliateDataConfig;
        this.affiliateData = parsed;
        const ageHours = Math.round(ageMs / (1000 * 60 * 60));
      } else {
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
      }
    } catch (err) {
    }
  }

  /**
   * Get item by index
   * @param index - Index of the item to retrieve
   * @returns AffiliateItem or null if not found
   */
  getItemByIndex(index: number): AffiliateItem | null {
    if (!this.affiliateData || !Array.isArray(this.affiliateData.items)) {
      return null;
    }

    if (index < 0 || index >= this.affiliateData.items.length) {
      return null;
    }

    return this.affiliateData.items[index];
  }

  /**
   * Get random item from affiliate data
   * @returns Random AffiliateItem or null if no data available
   */
  getRandomItem(): AffiliateItem | null {
    if (!this.affiliateData || !Array.isArray(this.affiliateData.items) || this.affiliateData.items.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.affiliateData.items.length);
    return this.affiliateData.items[randomIndex];
  }

  /**
   * Get all affiliate items
   * @returns Array of all affiliate items
   */
  getAllItems(): AffiliateItem[] {
    return this.affiliateData?.items || [];
  }

  /**
   * Get total count of affiliate items
   * @returns Total number of items
   */
  getItemCount(): number {
    return this.affiliateData?.items?.length || 0;
  }

  /**
   * Get items by type
   * @param type - "pack" or "product"
   * @returns Array of items filtered by type
   */
  getItemsByType(type: "pack" | "product"): AffiliateItem[] {
    return (this.affiliateData?.items || []).filter((item) => item.type === type);
  }

  /**
   * Check if affiliate service has data available
   * @returns true if data is available
   */
  isReady(): boolean {
    return this.affiliateData !== null && (this.affiliateData.items?.length || 0) > 0;
  }

  /**
   * Clear cache manually if needed
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
      this.affiliateData = null;
    } catch (err) {
    }
  }
}
