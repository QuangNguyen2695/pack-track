import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface SyncProgress {
  isVisible: boolean;
  isActive: boolean;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
  currentVideo?: string; // orderCode hiện tại đang sync
  status: 'idle' | 'syncing' | 'completed' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class SyncProgressService {
  private progressSubject = new BehaviorSubject<SyncProgress>({
    isVisible: false,
    isActive: false,
    totalVideos: 0,
    completedVideos: 0,
    failedVideos: 0,
    status: 'idle'
  });

  public progress$ = this.progressSubject.asObservable();

  /**
   * Bắt đầu sync process
   */
  startSync(totalVideos: number): void {
    this.progressSubject.next({
      isVisible: true,
      isActive: true,
      totalVideos,
      completedVideos: 0,
      failedVideos: 0,
      status: 'syncing'
    });
  }

  /**
   * Cập nhật progress khi sync một video
   */
  updateProgress(completedVideos: number, failedVideos: number, currentVideo?: string): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      completedVideos,
      failedVideos,
      currentVideo,
      status: 'syncing'
    });
  }

  /**
   * Hoàn thành sync process
   */
  completeSync(): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isActive: false,
      status: 'completed',
      currentVideo: undefined
    });

    // Auto hide sau 3 giây nếu sync thành công
    if (current.failedVideos === 0) {
      setTimeout(() => {
        this.hideProgress();
      }, 3000);
    }
  }

  /**
   * Đánh dấu sync bị lỗi
   */
  setError(): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isActive: false,
      status: 'error'
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
      status: 'idle'
    });
  }

  /**
   * Hiển thị progress widget mà không bắt đầu sync
   */
  showProgress(): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      isVisible: true
    });
  }

  /**
   * Get current progress value
   */
  getCurrentProgress(): SyncProgress {
    return this.progressSubject.value;
  }
}