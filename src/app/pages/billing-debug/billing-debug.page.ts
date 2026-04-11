import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { LogCaptureService, LogEntry } from "../../shared/services/log-capture/log-capture.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { BillingService } from "@rsApp/shared/services/billing/billing.service";

@Component({
  selector: "app-billing-debug",
  templateUrl: "./billing-debug.page.html",
  styleUrls: ["./billing-debug.page.scss"],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class BillingDebugPage implements OnInit, OnDestroy {
  @ViewChild("logsContainer", { static: false }) logsContainer?: ElementRef;

  logs: LogEntry[] = [];
  filteredLogs: LogEntry[] = [];
  filterLevel: string = "all";
  filterKeyword: string = "";
  stats: any = {};
  autoscroll: boolean = true;
  isPaused: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private logCaptureService: LogCaptureService,
    private billing: BillingService,
  ) {}

  ngOnInit(): void {
    // Subscribe to logs
    this.logCaptureService
      .getLogs$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((logs) => {
        if (!this.isPaused) {
          this.logs = logs;
          this.applyFilters();
          this.updateStats();
          this.autoScroll();
        }
      });

    // Log page init
    console.error("🔧 [BillingDebugPage] Debug page initialized");
    console.error("📊 Diagnostic data:", this.billing.getDiagnostics());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Apply filters to logs
   */
  applyFilters(): void {
    this.filteredLogs = this.logs.filter((log) => {
      const levelMatch = this.filterLevel === "all" || log.level === this.filterLevel;
      const keywordMatch = !this.filterKeyword || log.message.toLowerCase().includes(this.filterKeyword.toLowerCase());
      return levelMatch && keywordMatch;
    });
  }

  /**
   * On filter level change
   */
  onFilterLevelChange(): void {
    this.applyFilters();
  }

  /**
   * On filter keyword change
   */
  onFilterKeywordChange(): void {
    this.applyFilters();
  }

  /**
   * Update statistics
   */
  updateStats(): void {
    this.stats = this.logCaptureService.getStats();
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logCaptureService.clearLogs();
    this.logs = [];
    this.filteredLogs = [];
    console.error("🗑️ [BillingDebugPage] Logs cleared");
  }

  /**
   * Download logs as JSON
   */
  downloadLogs(): void {
    this.logCaptureService.downloadLogs();
    console.error("💾 [BillingDebugPage] Logs downloaded as JSON");
  }

  /**
   * Export logs as CSV
   */
  exportAsCSV(): void {
    this.logCaptureService.exportAsCSV();
    console.error("💾 [BillingDebugPage] Logs exported as CSV");
  }

  /**
   * Download JSON file to device storage
   */
  async downloadFileToDevice(): Promise<void> {
    console.error("⏳ [BillingDebugPage] Downloading JSON file to device...");
    const result = await this.logCaptureService.downloadLogsToDevice();

    if (result.success) {
      console.error("✅ [BillingDebugPage] File saved successfully!");
      console.error("📁 Path:", result.path);
      this.showToast(`✅ File saved!`);
    } else {
      console.error("❌ [BillingDebugPage] Failed to download file");
      console.error("Error:", result.error);
      this.showToast(`❌ ${result.error || "Failed to save file"}`, "danger");
    }
  }

  /**
   * Download CSV file to device storage
   */
  async exportFileToDevice(): Promise<void> {
    console.error("⏳ [BillingDebugPage] Exporting CSV file to device...");
    const result = await this.logCaptureService.exportAsCSVToDevice();

    if (result.success) {
      console.error("✅ [BillingDebugPage] CSV file saved successfully!");
      console.error("📁 Path:", result.path);
      this.showToast(`✅ CSV file saved!`);
    } else {
      console.error("❌ [BillingDebugPage] Failed to export CSV file");
      console.error("Error:", result.error);
      this.showToast(`❌ ${result.error || "Failed to save CSV file"}`, "danger");
    }
  }

  /**
   * Copy all logs to clipboard
   */
  async copyLogs(): Promise<void> {
    const success = await this.logCaptureService.copyLogsToClipboard();
    if (success) {
      console.error("📋 [BillingDebugPage] Logs copied to clipboard!");
      this.showToast("Logs copied to clipboard!");
    } else {
      console.error("❌ [BillingDebugPage] Failed to copy logs");
      this.showToast("Failed to copy logs", "danger");
    }
  }

  /**
   * Show toast notification
   */
  private showToast(message: string, color: string = "success"): void {
    // Simple console notification for now
    console.error(`${color === "success" ? "✅" : "❌"} ${message}`);
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    this.isPaused = !this.isPaused;
    console.error(`⏸️ [BillingDebugPage] Logs ${this.isPaused ? "paused" : "resumed"}`);
  }

  /**
   * Toggle autoscroll
   */
  toggleAutoscroll(): void {
    this.autoscroll = !this.autoscroll;
    console.error(`📌 [BillingDebugPage] Autoscroll ${this.autoscroll ? "enabled" : "disabled"}`);
  }

  /**
   * Auto scroll to bottom
   */
  private autoScroll(): void {
    if (!this.autoscroll || !this.logsContainer) return;
    setTimeout(() => {
      const container = this.logsContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  /**
   * Get log level class for styling
   */
  getLevelClass(level: string): string {
    switch (level) {
      case "error":
        return "log-error";
      case "warn":
        return "log-warn";
      case "info":
        return "log-info";
      default:
        return "log-default";
    }
  }

  /**
   * Get log level emoji
   */
  getLevelEmoji(level: string): string {
    switch (level) {
      case "error":
        return "❌";
      case "warn":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "📝";
    }
  }

  /**
   * Trigger billing diagnosis
   */
  triggerDiagnosis(): void {
    console.error("🏥 [BillingDebugPage] Triggering diagnosis...");
    this.billing.logStoreState();
  }

  /**
   * Test purchase
   */
  testPurchase(): void {
    console.error("🧪 [BillingDebugPage] Testing purchase flow...");
    this.billing.debugPurchaseFlow().catch((error: any) => {
      console.error("❌ Test failed:", error);
    });
  }

  /**
   * Check subscription status
   */
  checkSubscriptionStatus(): void {
    console.error("🔍 [BillingDebugPage] Checking subscription status...");
    const hasActive = this.billing.hasActiveSubscription();
    console.error("📊 Has active subscription:", hasActive);
  }

  /**
   * Get indentation for group level
   */
  getIndentation(groupLevel: number): string {
    return `${groupLevel * 20}px`;
  }

  /**
   * TrackBy function for ngFor performance
   */
  trackByIndex(index: number): number {
    return index;
  }
}
