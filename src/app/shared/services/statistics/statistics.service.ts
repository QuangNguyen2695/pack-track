import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

export interface DailyStats {
  date: string; // YYYY-MM-DD
  adsPlayed: number;
  videosRecorded: number;
}

@Injectable({ providedIn: "root" })
export class StatisticsService {
  private readonly STORAGE_KEY = "daily_statistics";
  
  // Observable để thông báo khi stats thay đổi
  private statsChanged$ = new Subject<DailyStats>();
  
  // Public observable để components subscribe
  public statsUpdated$ = this.statsChanged$.asObservable();

  constructor() {}

  /**
   * Lấy thống kê hôm nay
   */
  getTodayStats(): DailyStats {
    const today = this.getTodayDateString();
    const stats = this.loadStats();
    
    if (stats.date !== today) {
      // Ngày mới, reset counters
      return {
        date: today,
        adsPlayed: 0,
        videosRecorded: 0,
      };
    }
    
    return stats;
  }

  /**
   * Tăng counter quảng cáo
   */
  incrementAdsPlayed(): void {
    const stats = this.getTodayStats();
    stats.adsPlayed++;
    this.saveStats(stats);
    // Emit event để notify subscribers
    this.statsChanged$.next(stats);
  }

  /**
   * Tăng counter video đã quay
   */
  incrementVideosRecorded(): void {
    const stats = this.getTodayStats();
    stats.videosRecorded++;
    this.saveStats(stats);
    // Emit event để notify subscribers
    this.statsChanged$.next(stats);
  }

  /**
   * Reset thống kê (dùng khi cần)
   */
  resetStats(): void {
    const today = this.getTodayDateString();
    this.saveStats({
      date: today,
      adsPlayed: 0,
      videosRecorded: 0,
    });
  }

  /**
   * Lấy ngày hôm nay dạng YYYY-MM-DD
   */
  private getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Load stats từ localStorage
   */
  private loadStats(): DailyStats {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      // Error loading stats silently
    }
    
    const today = this.getTodayDateString();
    return {
      date: today,
      adsPlayed: 0,
      videosRecorded: 0,
    };
  }

  /**
   * Lưu stats vào localStorage
   */
  private saveStats(stats: DailyStats): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      // Error saving stats silently
    }
  }
}
