import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { NzProgressModule } from "ng-zorro-antd/progress";
import { Subject, takeUntil } from "rxjs";
import { RecoveryProgressService, RecoveryProgressState } from "@rsApp/shared/services/video-recovery/recovery-progress.service";

@Component({
  selector: "app-recovery-status-widget",
  standalone: true,
  imports: [CommonModule, IonicModule, NzProgressModule],
  templateUrl: "./recovery-status-widget.component.html",
  styleUrls: ["./recovery-status-widget.component.scss"],
})
export class RecoveryStatusWidgetComponent implements OnInit, OnDestroy {
  progressState: RecoveryProgressState = {
    isActive: false,
    status: "idle",
    totalVideos: 0,
    currentCount: 0,
    recoveredCount: 0,
    failedCount: 0,
    message: "",
    progress: 0,
  };

  isMinimized = false;
  private destroy$ = new Subject<void>();

  constructor(private recoveryProgress: RecoveryProgressService) {}

  ngOnInit(): void {
    this.recoveryProgress.progress$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.progressState = state;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isVisible(): boolean {
    return this.progressState.isActive;
  }

  getStatusIcon(): string {
    switch (this.progressState.status) {
      case "scanning":
        return "search";
      case "reconstructing":
        return "layers";
      case "saving":
        return "save";
      case "complete":
        return this.progressState.failedCount > 0 ? "alert-circle" : "checkmark-circle";
      case "error":
        return "alert-circle";
      default:
        return "image";
    }
  }

  getStatusText(): string {
    switch (this.progressState.status) {
      case "scanning":
        return `🔍 Quét video trên thiết bị...`;
      case "reconstructing":
        return `📋 Xây dựng lại siêu dữ liệu...`;
      case "saving":
        return `💾 Lưu các video được khôi phục...`;
      case "complete":
        return this.progressState.failedCount > 0
          ? `⚠️ Khôi phục hoàn tất (${this.progressState.failedCount} thất bại)`
          : `✅ Khôi phục hoàn tất`;
      case "error":
        return "❌ Khôi phục thất bại";
      default:
        return "🎥 Khôi phục video";
    }
  }

  getProgressPercentage(): number {
    if (this.progressState.totalVideos === 0) return 0;
    return this.progressState.progress || 0;
  }

  getProgressStatus(): "success" | "exception" | "active" | "normal" {
    if (this.progressState.status === "complete") {
      return this.progressState.failedCount > 0 ? "exception" : "success";
    }
    if (this.progressState.status === "error") {
      return "exception";
    }
    if (this.progressState.isActive) {
      return "active";
    }
    return "normal";
  }

  onToggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }

  onClose(): void {
    this.isMinimized = true;
  }
}
