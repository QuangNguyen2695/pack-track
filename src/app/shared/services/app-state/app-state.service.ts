import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

export interface AppState {
  appCheckFailed: boolean;
  appCheckError?: string;
}

@Injectable({
  providedIn: "root",
})
export class AppStateService {
  private appState = new BehaviorSubject<AppState>({
    appCheckFailed: false,
  });

  appState$: Observable<AppState> = this.appState.asObservable();

  constructor() {}

  /**
   * Set appCheck as failed
   * @param error Error message to display
   */
  setAppCheckFailed(error?: string) {
    const state = this.appState.getValue();
    this.appState.next({
      ...state,
      appCheckFailed: true,
      appCheckError:
        error ||
        "App verification failed. Please update or reinstall the app from Google Play Store.",
    });
  }

  /**
   * Get current app state
   */
  getAppState(): AppState {
    return this.appState.getValue();
  }

  /**
   * Reset app state
   */
  resetAppState() {
    this.appState.next({
      appCheckFailed: false,
    });
  }
}
