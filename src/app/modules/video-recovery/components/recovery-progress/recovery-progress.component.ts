import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule, ModalController } from "@ionic/angular";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { RecoveryProgressService, RecoveryProgressState } from "@rsApp/shared/services/video-recovery/recovery-progress.service";

/**
 * Optional Modal Component for displaying video recovery progress
 *
 * Usage in AppComponent or another component:
 *
 * async showRecoveryModal() {
 *   const modal = await this.modalController.create({
 *     component: RecoveryProgressComponent,
 *     cssClass: 'recovery-modal',
 *     backdropDismiss: false,
 *   });
 *   await modal.present();
 * }
 */
@Component({
  selector: "app-recovery-progress",
  templateUrl: "./recovery-progress.component.html",
  styleUrls: ["./recovery-progress.component.scss"],
  standalone: true,
  imports: [CommonModule, IonicModule, NZModule],
})
export class RecoveryProgressComponent implements OnInit, OnDestroy {
  progressState: RecoveryProgressState | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private recoveryProgress: RecoveryProgressService,
    private modalController: ModalController,
  ) {}

  ngOnInit(): void {
    this.recoveryProgress.progress$.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.progressState = state;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async dismiss(): Promise<void> {
    await this.modalController.dismiss();
  }

  getStatusIcon(): string {
    switch (this.progressState?.status) {
      case "scanning":
        return "🔍";
      case "reconstructing":
        return "📋";
      case "saving":
        return "💾";
      case "complete":
        return "✅";
      case "error":
        return "❌";
      default:
        return "⏳";
    }
  }

  getStatusText(): string {
    switch (this.progressState?.status) {
      case "scanning":
        return "Quét thiết bị";
      case "reconstructing":
        return "Xây dựng lại siêu dữ liệu";
      case "saving":
        return "Lưu vào bộ nhớ";
      case "complete":
        return "Khôi phục hoàn tất";
      case "error":
        return "Khôi phục thất bại";
      default:
        return "Đang khởi tạo...";
    }
  }
}
