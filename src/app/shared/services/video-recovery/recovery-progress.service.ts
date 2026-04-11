import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Recovery progress state
 */
export interface RecoveryProgressState {
  isActive: boolean;
  status: 'idle' | 'scanning' | 'reconstructing' | 'saving' | 'complete' | 'error';
  totalVideos: number;
  currentCount: number;
  recoveredCount: number;
  failedCount: number;
  message: string;
  error?: string;
  progress: number; // 0-100
}

/**
 * Service to track video recovery progress
 * 
 * Can be used to display progress UI to the user
 * Usage in component: inject service and subscribe to progress$
 */
@Injectable({
  providedIn: 'root'
})
export class RecoveryProgressService {
  private initialState: RecoveryProgressState = {
    isActive: false,
    status: 'idle',
    totalVideos: 0,
    currentCount: 0,
    recoveredCount: 0,
    failedCount: 0,
    message: '',
    progress: 0,
  };

  private progressSubject = new BehaviorSubject<RecoveryProgressState>(this.initialState);
  public progress$ = this.progressSubject.asObservable();

  constructor() {}

  // Observable for component subscriptions
  getProgress(): Observable<RecoveryProgressState> {
    return this.progress$;
  }

  // Get current state
  getCurrentState(): RecoveryProgressState {
    return this.progressSubject.value;
  }

  // Update progress
  setStatus(status: RecoveryProgressState['status']): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({
      ...current,
      status,
    });
  }

  setCurrent(current: number, message: string = ''): void {
    const state = this.progressSubject.value;
    const progress = state.totalVideos > 0 
      ? Math.round((current / state.totalVideos) * 100)
      : 0;

    this.progressSubject.next({
      ...state,
      currentCount: current,
      message: message || state.message,
      progress,
    });
  }

  startScanning(totalVideos: number): void {
    this.progressSubject.next({
      isActive: true,
      status: 'scanning',
      totalVideos,
      currentCount: 0,
      recoveredCount: 0,
      failedCount: 0,
      message: `🔍 Scanning device for ${totalVideos} videos...`,
      progress: 0,
    });
  }

  startReconstruction(totalVideos: number): void {
    this.progressSubject.next({
      ...this.progressSubject.value,
      status: 'reconstructing',
      totalVideos,
      currentCount: 0,
      message: `📋 Reconstructing metadata for ${totalVideos} videos...`,
      progress: 0,
    });
  }

  updateReconstruction(current: number, recovered: number, failed: number): void {
    const state = this.progressSubject.value;
    const progress = state.totalVideos > 0
      ? Math.round((current / state.totalVideos) * 100)
      : 0;

    this.progressSubject.next({
      ...state,
      currentCount: current,
      recoveredCount: recovered,
      failedCount: failed,
      message: `📋 Processing ${current}/${state.totalVideos}...`,
      progress,
    });
  }

  startSaving(recoveredCount: number): void {
    this.progressSubject.next({
      ...this.progressSubject.value,
      status: 'saving',
      currentCount: recoveredCount,
      recoveredCount,
      message: `💾 Saving ${recoveredCount} recovered videos to storage...`,
      progress: 75,
    });
  }

  complete(recoveredCount: number): void {
    this.progressSubject.next({
      isActive: false,
      status: 'complete',
      totalVideos: recoveredCount,
      currentCount: recoveredCount,
      recoveredCount,
      failedCount: 0,
      message: `✅ Recovery complete! ${recoveredCount} videos recovered.`,
      progress: 100,
    });
  }

  error(errorMessage: string): void {
    this.progressSubject.next({
      ...this.progressSubject.value,
      isActive: false,
      status: 'error',
      message: `❌ Recovery failed!`,
      error: errorMessage,
      progress: 0,
    });
  }

  reset(): void {
    this.progressSubject.next(this.initialState);
  }
}
