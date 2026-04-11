import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
  data?: any[];
  groupLevel: number;
}

@Injectable({
  providedIn: 'root',
})
export class LogCaptureService {
  private logs$ = new BehaviorSubject<LogEntry[]>([]);
  private maxLogs = 1000; // Keep last 1000 logs
  private currentGroupLevel = 0;

  constructor() {
    this.setupConsoleCapture();
  }

  /**
   * Capture all console methods
   */
  private setupConsoleCapture(): void {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalGroup = console.group;
    const originalGroupEnd = console.groupEnd;

    console.log = (...args: any[]) => {
      originalLog(...args);
      this.addLog('log', args);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      this.addLog('error', args);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      this.addLog('warn', args);
    };

    console.info = (...args: any[]) => {
      originalInfo(...args);
      this.addLog('info', args);
    };

    console.group = (label?: string) => {
      originalGroup(label);
      if (label) {
        this.addLog('log', [label]);
        this.currentGroupLevel++;
      }
    };

    console.groupEnd = () => {
      originalGroupEnd();
      if (this.currentGroupLevel > 0) {
        this.currentGroupLevel--;
      }
    };
  }

  /**
   * Add log entry
   */
  private addLog(level: 'log' | 'error' | 'warn' | 'info', data: any[]): void {
    const logs = this.logs$.value;
    
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      }),
      level,
      message: this.formatMessage(data),
      data,
      groupLevel: this.currentGroupLevel,
    };

    logs.push(entry);

    // Keep only last maxLogs entries
    if (logs.length > this.maxLogs) {
      logs.shift();
    }

    this.logs$.next([...logs]);
  }

  /**
   * Format log message
   */
  private formatMessage(data: any[]): string {
    return data
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'number') return String(arg);
        if (typeof arg === 'boolean') return String(arg);
        if (typeof arg === 'undefined') return 'undefined';
        if (arg === null) return 'null';
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  }

  /**
   * Get logs stream
   */
  getLogs$() {
    return this.logs$.asObservable();
  }

  /**
   * Get current logs
   */
  getLogs(): LogEntry[] {
    return this.logs$.value;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs$.next([]);
  }

  /**
   * Filter logs by level
   */
  filterByLevel(level: string): LogEntry[] {
    return this.logs$.value.filter((log) => log.level === level);
  }

  /**
   * Filter logs by keyword
   */
  filterByKeyword(keyword: string): LogEntry[] {
    const lower = keyword.toLowerCase();
    return this.logs$.value.filter((log) => log.message.toLowerCase().includes(lower));
  }

  /**
   * Download logs as JSON to device storage
   */
  async downloadLogsToDevice(): Promise<{ success: boolean; path: string; error?: string }> {
    try {
      const logs = this.logs$.value;
      const json = JSON.stringify(logs, null, 2);
      const fileName = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      
      console.error(`💾 [LogCaptureService] Attempting to save file: ${fileName}`);
      console.error(`  File size: ${(json.length / 1024).toFixed(2)} KB`);
      
      // Try to save to Documents directory
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: json,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        
        const documentsPath = await Filesystem.getUri({
          path: '',
          directory: Directory.Documents,
        });
        
        const fullPath = `${documentsPath.uri}${fileName}`;
        console.error(`✅ [LogCaptureService] File saved to Documents: ${fullPath}`);
        
        return {
          success: true,
          path: fullPath,
        };
      } catch (docError) {
        console.warn(`⚠️ Failed to save to Documents, trying Cache directory:`, docError);
        
        // Fallback to Cache directory
        await Filesystem.writeFile({
          path: fileName,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        
        const cachePath = await Filesystem.getUri({
          path: '',
          directory: Directory.Cache,
        });
        
        const fullPath = `${cachePath.uri}${fileName}`;
        console.error(`✅ [LogCaptureService] File saved to Cache: ${fullPath}`);
        
        return {
          success: true,
          path: fullPath,
        };
      }
    } catch (error) {
      console.error('❌ [LogCaptureService] Failed to download logs:', error);
      return {
        success: false,
        path: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Download logs as JSON (browser fallback)
   */
  downloadLogs(): void {
    const logs = this.logs$.value;
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.error('💾 [LogCaptureService] Logs downloaded as JSON (browser)');
  }

  /**
   * Export logs as CSV to device storage
   */
  async exportAsCSVToDevice(): Promise<{ success: boolean; path: string; error?: string }> {
    try {
      const logs = this.logs$.value;
      let csv = 'timestamp,level,message\n';
      
      logs.forEach((log) => {
        const timestamp = log.timestamp;
        const level = log.level;
        const message = `"${log.message.replace(/"/g, '""')}"`;
        csv += `${timestamp},${level},${message}\n`;
      });

      const fileName = `logs-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      
      console.error(`💾 [LogCaptureService] Attempting to save CSV: ${fileName}`);
      console.error(`  File size: ${(csv.length / 1024).toFixed(2)} KB`);
      
      // Try to save to Documents directory
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        
        const documentsPath = await Filesystem.getUri({
          path: '',
          directory: Directory.Documents,
        });
        
        const fullPath = `${documentsPath.uri}${fileName}`;
        console.error(`✅ [LogCaptureService] CSV saved to Documents: ${fullPath}`);
        
        return {
          success: true,
          path: fullPath,
        };
      } catch (docError) {
        console.warn(`⚠️ Failed to save CSV to Documents, trying Cache:`, docError);
        
        // Fallback to Cache directory
        await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        
        const cachePath = await Filesystem.getUri({
          path: '',
          directory: Directory.Cache,
        });
        
        const fullPath = `${cachePath.uri}${fileName}`;
        console.error(`✅ [LogCaptureService] CSV saved to Cache: ${fullPath}`);
        
        return {
          success: true,
          path: fullPath,
        };
      }
    } catch (error) {
      console.error('❌ [LogCaptureService] Failed to export CSV:', error);
      return {
        success: false,
        path: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Export logs as CSV (browser fallback)
   */
  exportAsCSV(): void {
    const logs = this.logs$.value;
    let csv = 'timestamp,level,message\n';
    
    logs.forEach((log) => {
      const timestamp = log.timestamp;
      const level = log.level;
      const message = `"${log.message.replace(/"/g, '""')}"`;
      csv += `${timestamp},${level},${message}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.error('💾 [LogCaptureService] Logs exported as CSV (browser)');
  }

  /**
   * Get statistics
   */
  getStats() {
    const logs = this.logs$.value;
    return {
      total: logs.length,
      errors: logs.filter((l) => l.level === 'error').length,
      warnings: logs.filter((l) => l.level === 'warn').length,
      info: logs.filter((l) => l.level === 'info').length,
      logs: logs.filter((l) => l.level === 'log').length,
    };
  }

  /**
   * Copy all logs as formatted text to clipboard
   */
  async copyLogsToClipboard(): Promise<boolean> {
    try {
      const logs = this.logs$.value;
      const text = this.formatLogsAsText(logs);
      
      // Try using native Clipboard API
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        console.log('✅ Logs copied to clipboard (Clipboard API)');
        return true;
      } else {
        // Fallback: create temporary element and copy
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
          console.log('✅ Logs copied to clipboard (fallback method)');
        } else {
          console.error('❌ Failed to copy logs');
        }
        return success;
      }
    } catch (error) {
      console.error('❌ Error copying logs:', error);
      return false;
    }
  }

  /**
   * Format logs as readable text
   */
  private formatLogsAsText(logs: LogEntry[]): string {
    let text = `LOGS EXPORTED: ${new Date().toLocaleString('vi-VN')}\n`;
    text += `Total Logs: ${logs.length}\n`;
    text += `Errors: ${logs.filter(l => l.level === 'error').length}\n`;
    text += `Warnings: ${logs.filter(l => l.level === 'warn').length}\n`;
    text += `Info: ${logs.filter(l => l.level === 'info').length}\n`;
    text += `\n${'='.repeat(80)}\n\n`;

    logs.forEach((log) => {
      const indent = '  '.repeat(log.groupLevel);
      text += `[${log.timestamp}] [${log.level.toUpperCase()}]\n`;
      text += `${indent}${log.message}\n`;
    });

    text += `\n${'='.repeat(80)}\n`;
    text += `END OF LOGS - ${new Date().toLocaleString('vi-VN')}\n`;
    
    return text;
  }
}
