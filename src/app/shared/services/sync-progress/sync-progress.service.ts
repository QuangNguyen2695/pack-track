import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { PackService } from "../pack-service/pack.service";
import { SettingsService } from "../settings/settings.service";
import { PackDoc } from "@rsApp/shared/models/pack.model";

export interface SyncProgress {
  isVisible: boolean;
  isActive: boolean;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  deletedVideos: number;
  scanCount?: number; // Số video cần xóa (hiển thị khi scanning)
  currentVideo?: string; // orderCode hiện tại đang xóa
  status: "idle" | "scanning" | "syncing" | "completed" | "error" | "no-videos";
}

@Injectable({
  providedIn: "root",
})
export class SyncProgressService {
  private readonly LAST_AUTO_DELETE_KEY = "last_auto_delete_timestamp";
  private readonly AUTO_DELETE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private progressSubject = new BehaviorSubject<SyncProgress>({
    isVisible: false,
    isActive: false,
    totalVideos: 0,
    completedVideos: 0,
    failedVideos: 0,
    deletedVideos: 0,
    status: "idle",
  });

  public progress$ = this.progressSubject.asObservable();

  constructor(
    private packService: PackService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Check if 24 hours have passed since the last auto-delete check
   * Returns true if enough time has passed or if never checked before
   */
  private hasEnoughTimePassedSinceLastCheck(): boolean {
    try {
      const lastCheckStr = localStorage.getItem(this.LAST_AUTO_DELETE_KEY);

      if (!lastCheckStr) {
        return true; // First time, allow check
      }

      const lastCheckTime = parseInt(lastCheckStr, 10);
      const now = Date.now();
      const timeSinceLast = now - lastCheckTime;

      if (timeSinceLast >= this.AUTO_DELETE_INTERVAL_MS) {
        return true; // Enough time has passed
      } else {
        const remainingMs = this.AUTO_DELETE_INTERVAL_MS - timeSinceLast;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return false; // Not enough time has passed
      }
    } catch (error) {
      return true; // On error, allow check
    }
  }

  /**
   * Update the last auto-delete check timestamp
   */
  private updateLastAutoDeleteTime(): void {
    try {
      localStorage.setItem(this.LAST_AUTO_DELETE_KEY, Date.now().toString());
    } catch (error) {
    }
  }

  /**
   * STEP 1: Tính toán số lượng video cần xóa
   * Không xóa, chỉ đếm
   */
  private async calculateVideosToDelete(): Promise<{ videosToDelete: PackDoc[]; cutoffDate: Date }> {
    const settings = this.settingsService.getSettings();

    if (!settings.autoDeleteVideosAfterDays) {
      return { videosToDelete: [], cutoffDate: new Date() };
    }

    const allPacks = await (this.packService as any).getAllPacks();
    const thresholdDays = settings.autoDeleteVideosAfterDays;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    const videosToDelete = allPacks.filter((pack: PackDoc) => {
      const lastAccessDate = pack.lastAccessAt ? new Date(pack.lastAccessAt) : new Date(pack.createdAt);
      return lastAccessDate < cutoffDate;
    });

    videosToDelete.forEach((p: PackDoc) => {
      const lastAccessDate = p.lastAccessAt ? new Date(p.lastAccessAt) : new Date(p.createdAt);
    });

    return { videosToDelete, cutoffDate };
  }

  /**
   * STEP 2: Hiển thị thông báo số lượng video sẽ xóa
   * "Bắt đầu xóa X video cũ"
   */
  private showScanResult(count: number, thresholdDays: number): void {
    this.progressSubject.next({
      isVisible: true,
      isActive: false,
      totalVideos: count,
      completedVideos: 0,
      failedVideos: 0,
      deletedVideos: 0,
      scanCount: count,
      status: "scanning",
    });
  }

  /**
   * Show "No videos found" notification
   */
  private showNoVideosNotification(): void {
    this.progressSubject.next({
      isVisible: true,
      isActive: false,
      totalVideos: 0,
      completedVideos: 0,
      failedVideos: 0,
      deletedVideos: 0,
      scanCount: 0,
      status: "no-videos",
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideProgress();
    }, 3000);
  }

  /**
   * STEP 3: Bắt đầu quá trình xóa (sau khi hiển thị thông báo)
   */
  private startDeleteProcess(totalCount: number): void {
    this.progressSubject.next({
      isVisible: true,
      isActive: true,
      totalVideos: totalCount,
      completedVideos: 0,
      failedVideos: 0,
      deletedVideos: 0,
      scanCount: undefined,
      status: "syncing",
    });
  }

  /**
   * Cập nhật progress khi xóa một video
   */
  updateProgress(completedVideos: number, deletedVideos: number, failedVideos: number, currentVideo?: string): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      completedVideos,
      deletedVideos,
      failedVideos,
      currentVideo,
      status: "syncing",
    });
  }

  /**
   * MAIN: Xóa các video cũ theo cài đặt auto-delete
   * Chỉ chạy 1 lần mỗi 24 giờ
   * Step-by-step process:
   * 1. Kiểm tra xem đã 24h kể từ lần cuối không
   * 2. Tính toán số lượng video cần xóa
   * 3. Nếu không có video → hiển thị "Không có video cũ cần xóa"
   * 4. Nếu có video → hiển thị "Bắt đầu xóa X video cũ"
   * 5. Chờ vài giây
   * 6. Thực hiện xóa
   * 7. Hiển thị kết quả
   */
  async processAutoDelete(): Promise<void> {
    try {
      // STEP 0: Check if enough time has passed since last check
      // if (!this.hasEnoughTimePassedSinceLastCheck()) {
      //   return; // Skip silently
      // }

      const settings = this.settingsService.getSettings();

      if (!settings.autoDeleteVideosAfterDays) {
        this.updateLastAutoDeleteTime(); // Update timestamp even if disabled
        this.completeDelete(true);
        return;
      }

      const { videosToDelete, cutoffDate } = await this.calculateVideosToDelete();

      // STEP 2: Check if any videos found
      if (videosToDelete.length === 0) {
        this.updateLastAutoDeleteTime(); // Update timestamp for no-videos case
        this.hideProgress(); // Don't show widget if no videos found
        return;
      }

      // STEP 3: Hiển thị thông báo "Bắt đầu xóa X video cũ"
      this.showScanResult(videosToDelete.length, settings.autoDeleteVideosAfterDays);

      // STEP 4: Chờ 3 giây để user thấy thông báo
      await this.delay(3000);

      // STEP 5: Bắt đầu xóa thực tế
      this.startDeleteProcess(videosToDelete.length);

      // STEP 6: Xóa từng video
      let completedCount = 0;
      let deletedCount = 0;
      let failedCount = 0;

      for (const pack of videosToDelete) {
        try {
          this.updateProgress(completedCount, deletedCount, failedCount, pack.orderCode);

          await this.packService.remove(pack._id).toPromise();

          deletedCount++;
          completedCount++;
        } catch (error) {
          failedCount++;
          completedCount++;
        }
      }

      // STEP 7: Update timestamp after successful completion
      this.updateLastAutoDeleteTime();

      this.completeDelete(failedCount === 0);
    } catch (error) {
      this.setError();
    }
  }

  /**
   * Helper: Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Hoàn thành auto-delete process
   */
  completeDelete(success: boolean = true): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isActive: false,
      status: success ? "completed" : "error",
      currentVideo: undefined,
      scanCount: undefined,
    });

    // Auto hide sau 3 giây nếu auto-delete thành công
    if (success && current.failedVideos === 0) {
      setTimeout(() => {
        this.hideProgress();
      }, 3000);
    }
  }

  /**
   * Đánh dấu auto-delete bị lỗi
   */
  setError(): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isActive: false,
      status: "error",
    });
  }

  /**
   * Ẩn progress widget
   */
  hideProgress(): void {
    this.progressSubject.next({
      isVisible: false,
      isActive: false,
      totalVideos: 0,
      completedVideos: 0,
      failedVideos: 0,
      deletedVideos: 0,
      scanCount: undefined,
      status: "idle",
    });
  }

  /**
   * Hiển thị progress widget mà không bắt đầu sync
   */
  showProgress(): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isVisible: true,
    });
  }

  /**
   * Get current progress value
   */
  getCurrentProgress(): SyncProgress {
    return this.progressSubject.value;
  }
}
