import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { Subject, takeUntil } from "rxjs";
import { SyncProgress, SyncProgressService } from "@rsApp/shared/services/sync-progress/sync-progress.service";

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
    deletedVideos: 0,
    status: "idle",
  };

  isMinimized = false; // State để quản lý minimize

  private destroy$ = new Subject<void>();

  constructor(private syncProgressService: SyncProgressService) {}

  ngOnInit(): void {
    this.syncProgressService.progress$.pipe(takeUntil(this.destroy$)).subscribe((progress) => {
      this.progress = progress;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStatusIcon(): string {
    switch (this.progress.status) {
      case "scanning":
        return "download";
      case "syncing":
        return "sync";
      case "completed":
        return this.progress.failedVideos > 0 ? "alert-circle" : "checkmark-circle";
      case "error":
        return "alert-circle";
      case "no-videos":
        return "checkmark-circle";
      default:
        return "trash";
    }
  }

  getStatusText(): string {
    switch (this.progress.status) {
      case "scanning":
        return `� Bắt đầu xóa ${this.progress.scanCount || 0} video cũ`;
      case "syncing":
        return "🗑️ Đang xóa video cũ...";
      case "completed":
        return this.progress.failedVideos > 0 ? "⚠️ Xóa hoàn tất (có lỗi)" : `✅ Xóa thành công - Hoàn tất`;
      case "error":
        return "❌ Lỗi xóa video";
      case "no-videos":
        return "✅ Không có video cũ cần xóa - Hoàn tất";
      default:
        return "🗑️ Xóa video cũ";
    }
  }

  getProgressPercentage(): number {
    // During scanning and no-videos, show 100% (waiting state)
    if (this.progress.status === "scanning" || this.progress.status === "no-videos") {
      return 100;
    }
    // During deletion, show actual progress
    if (this.progress.totalVideos === 0) return 0;
    return ((this.progress.completedVideos + this.progress.failedVideos) / this.progress.totalVideos) * 100;
  }

  getProgressStatus(): "success" | "exception" | "active" | "normal" {
    if (this.progress.status === "scanning" || this.progress.status === "no-videos") {
      return "normal";
    }
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

  async onRetryDelete(): Promise<void> {
    try {
      await this.syncProgressService.processAutoDelete();
    } catch (error) {
      console.error("Retry delete failed:", error);
    }
  }
}
