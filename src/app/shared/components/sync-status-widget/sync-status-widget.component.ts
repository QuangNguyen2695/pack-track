import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { Subject, takeUntil } from "rxjs";
import { SyncProgress, SyncProgressService } from "@rsApp/shared/services/sync-progress/sync-progress.service";
import { VideoCacheService } from "@rsApp/shared/services/video-cache/video-cache.service";

@Component({
  selector: "app-sync-status-widget",
  standalone: true,
  imports: [CommonModule, IonicModule, NzProgressModule],
  templateUrl: "./sync-status-widget.component.html",
  styleUrls: ["./sync-status-widget.component.scss"],
})
export class SyncStatusWidgetComponent implements OnInit, OnDestroy {
  progress: SyncProgress = {
    isVisible: false,
    isActive: false,
    totalVideos: 0,
    completedVideos: 0,
    failedVideos: 0,
    status: "idle",
  };

  isMinimized = false; // State để quản lý minimize

  private destroy$ = new Subject<void>();

  constructor(private syncProgressService: SyncProgressService, private videoCacheService: VideoCacheService) {}

  ngOnInit(): void {
    this.syncProgressService.progress$.pipe(takeUntil(this.destroy$)).subscribe((progress) => {
      this.progress = progress;
      console.log("🚀 ~ SyncStatusWidgetComponent ~ ngOnInit ~ this.progress:", this.progress);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStatusIcon(): string {
    switch (this.progress.status) {
      case "syncing":
        return "sync";
      case "completed":
        return this.progress.failedVideos > 0 ? "alert-circle" : "checkmark-circle";
      case "error":
        return "alert-circle";
      default:
        return "cloud-upload";
    }
  }

  getStatusText(): string {
    switch (this.progress.status) {
      case "syncing":
        return "Đang đồng bộ video...";
      case "completed":
        return this.progress.failedVideos > 0 ? "Đồng bộ hoàn tất (có lỗi)" : "Đồng bộ thành công";
      case "error":
        return "Lỗi đồng bộ";
      default:
        return "Đồng bộ video";
    }
  }

  getProgressPercentage(): number {
    if (this.progress.totalVideos === 0) return 0;
    return ((this.progress.completedVideos + this.progress.failedVideos) / this.progress.totalVideos) * 100;
  }

  getProgressStatus(): "success" | "exception" | "active" | "normal" {
    if (this.progress.status === "completed") {
      return this.progress.failedVideos > 0 ? "exception" : "success";
    }
    if (this.progress.status === "error") {
      return "exception";
    }
    if (this.progress.isActive) {
      return "active";
    }
    return "normal";
  }

  onClose(): void {
    this.syncProgressService.hideProgress();
  }

  onToggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }

  async onRetrySync(): Promise<void> {
    try {
      await this.videoCacheService.syncWithLoading();
    } catch (error) {
      console.error("Retry sync failed:", error);
    }
  }
}
