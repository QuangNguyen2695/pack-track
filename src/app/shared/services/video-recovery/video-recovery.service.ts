import { Injectable } from "@angular/core";
import { Media } from "@capacitor-community/media";
import { Filesystem, Directory, FileInfo } from "@capacitor/filesystem";
import { PackService } from "../pack-service/pack.service";
import { DeviceInfoService } from "../device/device-info.service";
import { PackCreatePayload, PackDoc } from "@rsApp/shared/models/pack.model";
import { CameraBarcode } from "src/plugin/CameraXScanner";
import { Capacitor } from "@capacitor/core";
import { RecoveryProgressService } from "./recovery-progress.service";
import { Video } from "src/plugin/VideoScanner";

/**
 * Represents recoverable video metadata from device
 */
interface RecoverableVideo {
  videoStorageKey: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  modifiedDate: number; // timestamp
  duration?: number; // video duration in milliseconds
  thumbnailBase64?: string; // base64 encoded thumbnail image
  // Extracted from filename or metadata if possible
  orderCode?: string;
  videoType?: "normal" | "return";
}

/**
 * Video Cache Recovery Service
 *
 * Handles recovery of video metadata when app is freshly downloaded/installed.
 * Scans device media library for videos and reconstructs pack documents.
 *
 * Usage:
 * - Call on app startup to detect orphaned videos
 * - Called automatically as part of app initialization
 */
@Injectable({
  providedIn: "root",
})
export class VideoRecoveryService {
  private readonly ALBUM_NAME = "SafeTrack Videos";
  private readonly RECOVERY_MARKER = "video_recovery_version";
  private readonly RECOVERY_MARKER_VERSION = 1;
  private readonly MIN_VIDEO_SIZE = 100 * 1024; // 100KB minimum

  constructor(
    private packService: PackService,
    private deviceInfo: DeviceInfoService,
    private recoveryProgress: RecoveryProgressService,
  ) {}

  /**
   * Main recovery function - detect and restore videos from device
   * Returns count of recovered videos
   */
  async recoverOrphanedVideos(isForce: boolean = false): Promise<number> {
    try {
      console.log("🎬 [VideoRecovery] Starting recovery process...");

      // Check if recovery was already done
      if ((await this.isRecoveryAlreadyDone()) && !isForce) {
        console.log("✅ [VideoRecovery] Recovery already completed, skipping");
        return 0;
      }

      // Get existing packs to avoid duplicates
      this.recoveryProgress.startScanning(0); // Start scanning phase
      const existingPacks = await this.packService.getAllPacks();
      const existingPaths = new Set(existingPacks.map((p) => p.videoStorageKey).filter((p) => !!p));

      console.log(`📦 [VideoRecovery] Found ${existingPacks.length} existing packs`);

      // Scan device media library
      const videos = await this.scanDeviceVideos();
      console.log(`🎥 [VideoRecovery] Found ${videos.length} videos in device`);

      if (videos.length === 0) {
        await this.markRecoveryDone();
        this.recoveryProgress.complete(0);
        return 0;
      }

      // Update progress with total videos found
      this.recoveryProgress.startReconstruction(videos.length);

      // Filter out videos that are already tracked
      const orphanedVideos = videos.filter((v) => !existingPaths.has(v.filePath));
      console.log(`🔍 [VideoRecovery] Found ${orphanedVideos.length} orphaned videos`);

      if (orphanedVideos.length === 0) {
        await this.markRecoveryDone();
        this.recoveryProgress.complete(0);
        return 0;
      }

      // Reconstruct packs from orphaned videos
      const recoveredPacks = await this.reconstructPacksFromVideos(orphanedVideos);
      console.log(`📋 [VideoRecovery] Reconstructed ${recoveredPacks.length} packs`);

      // Update progress - now saving
      this.recoveryProgress.startSaving(recoveredPacks.length);

      // Save recovered packs to storage
      if (recoveredPacks.length > 0) {
        await this.saveRecoveredPacks(recoveredPacks);
        console.log(`✅ [VideoRecovery] Saved ${recoveredPacks.length} recovered packs to storage`);
      }

      // Mark recovery as done
      await this.markRecoveryDone();

      // Complete progress
      this.recoveryProgress.complete(recoveredPacks.length);

      return recoveredPacks.length;
    } catch (error) {
      console.error("❌ [VideoRecovery] Recovery failed:", error);
      this.recoveryProgress.error(String(error));
      return 0;
    }
  }

  /**
   * Scan app data directory and device media library for videos
   * Priority order:
   * 1. App Data Directory (safetrack/safetrackvideos/) - for moved/copied videos
   * 2. Camera Plugin Directory (SafeTrack/Video & SafeTrack/Video/Return) - MediaStore destination
   * 3. Device Media Library - fallback if in system albums
   */
  private async scanDeviceVideos(): Promise<RecoverableVideo[]> {
    try {
      const videos: RecoverableVideo[] = [];

      let deviceVideos: any[] = [];
      try {
        console.log("🔥 PLATFORM =", Capacitor.getPlatform());
        console.log("🔥 CALLING getAllVideos...");

        // Try to get videos with retry logic for permission timing issues
        let result: any;
        let retries = 0;
        const maxRetries = 2;

        while (retries < maxRetries) {
          try {
            result = await Video.getAllVideos();
            if (result?.videos) {
              console.log("🔥 RESULT =", result);
              break; // Success, exit retry loop
            }
            retries++;
            if (retries < maxRetries) {
              console.log(`⚠️ No videos returned, retrying... (${retries}/${maxRetries})`);
              await this.sleep(500); // Wait 500ms before retry
            }
          } catch (e) {
            retries++;
            if (retries < maxRetries) {
              console.log(`⚠️ getAllVideos failed, retrying... (${retries}/${maxRetries}):`, e);
              await this.sleep(500); // Wait 500ms before retry
            } else {
              throw e;
            }
          }
        }

        deviceVideos = result?.videos || [];
        console.log(`📂 [VideoRecovery] Found ${deviceVideos.length} videos from MediaStore`);
      } catch (e) {
        console.warn("⚠️ [VideoRecovery] Cannot query MediaStore", e);
      }

      for (const v of deviceVideos) {
        const uri = v.uri;

        // chỉ lấy SafeTrack
        if (!v.relativePath?.includes("SafeTrack")) continue;

        const recVideo: RecoverableVideo = {
          filePath: uri, // ⚠️ dùng URI thay vì path
          videoStorageKey: uri,
          fileName: v.fileName,
          fileSize: v.size,
          mimeType: "video/mp4",
          modifiedDate: v.date ? v.date * 1000 : Date.now(),

          // ✅ NEW: Duration and Thumbnail from plugin
          duration: v.duration, // milliseconds
          thumbnailBase64: v.thumbnail, // base64 encoded image

          // ✅ Use orderCode from plugin if available, otherwise extract from filename
          orderCode: this.extractOrderCodeFromFilename(v.fileName),

          videoType: v.relativePath.includes("Return") ? "return" : "normal",
        };

        videos.push(recVideo);

        const durationText = v.duration ? `${(v.duration / 1000).toFixed(2)}s` : "?";
        const hasThumbnail = v.thumbnail ? "✅" : "❌";
        console.log(`✅ [VideoRecovery] Added: ${v.fileName} (${recVideo.videoType}, ${durationText}, thumb: ${hasThumbnail})`);
      }

      console.log(`📂 [VideoRecovery] Total videos: ${videos.length}`);
      return videos;
    } catch (error) {
      console.error("❌ [VideoRecovery] Failed to scan device videos:", error);
      return [];
    }
  }

  /**
   * Reconstruct pack documents from recovered videos
   */
  private async reconstructPacksFromVideos(videos: RecoverableVideo[]): Promise<PackDoc[]> {
    const packs: PackDoc[] = [];
    const dev = await this.deviceInfo.getDeviceInfo();

    for (let index = 0; index < videos.length; index++) {
      const video = videos[index];
      try {
        // Update progress
        this.recoveryProgress.updateReconstruction(index + 1, packs.length, 0);

        // ✅ Use thumbnail from plugin if available
        let thumbnailBase64: string | undefined;
        if (video.thumbnailBase64) {
          thumbnailBase64 = video.thumbnailBase64;
          console.log(`📸 [VideoRecovery] Using thumbnail from plugin for ${video.fileName}`);
        } else {
          // Fallback: try to generate thumbnail (if plugin didn't provide one)
          try {
            thumbnailBase64 = await this.generateVideoThumbnail(video.filePath);
          } catch (error) {
            console.warn(`⚠️ [VideoRecovery] Failed to generate thumbnail for ${video.fileName}:`, error);
          }
        }

        // ✅ Use duration from plugin if available
        const timeRecordedMs = video.duration || 0;

        // Create pack payload from video metadata
        const payload: PackCreatePayload = {
          deviceId: dev.deviceId,
          packNumber: video.orderCode || this.sanitizeFileName(video.fileName),
          orderCode: video.orderCode,
          createDate: new Date(video.modifiedDate).toISOString(),
          startRecordDate: new Date(video.modifiedDate).toISOString(),
          endRecordDate: new Date(video.modifiedDate + timeRecordedMs).toISOString(),
          timeRecordedMs: timeRecordedMs, // ✅ Now properly set from plugin
          status: "recorded" as const,
          videoStorage: "local" as const,
          videoStorageKey: video.filePath,
          videoFileName: video.fileName,
          videoFileSize: video.fileSize,
          videoMimeType: video.mimeType,
          thumbnailStorage: thumbnailBase64 ? ("local" as const) : undefined,
          thumbnailBase64: thumbnailBase64,
          appVersion: dev.appVersion,
          tags: ["recovered"],
          notes: `Recovered from device on ${new Date().toISOString()}, Duration: ${timeRecordedMs}ms`,
          videoType: video.videoType || ("normal" as const),
        };

        // Generate pack document
        const pack = this.createPackFromPayload(payload);
        packs.push(pack);

        console.log(
          `✅ [VideoRecovery] Reconstructed pack: ${pack.packNumber} (${(timeRecordedMs / 1000).toFixed(2)}s) [${index + 1}/${videos.length}]`,
        );
      } catch (error) {
        console.error(`❌ [VideoRecovery] Failed to reconstruct pack for ${video.fileName}:`, error);
      }
    }

    return packs;
  }

  /**
   * Generate thumbnail from video file path using FFmpeg or native capability
   * For now, returns undefined - implement with native plugin if needed
   */
  private async generateVideoThumbnail(filePath: string): Promise<string | undefined> {
    try {
      // TODO: Implement with native FFmpeg plugin or capacitor video thumbnail plugin
      // For now, just return undefined
      // This would require additional native plugin integration
      return undefined;
    } catch (error) {
      console.warn("⚠️ [VideoRecovery] Thumbnail generation not implemented:", error);
      return undefined;
    }
  }

  /**
   * Create PackDoc from payload
   */
  private createPackFromPayload(payload: PackCreatePayload): PackDoc {
    return {
      _id: this.generateUUID(),
      deviceId: payload.deviceId,
      packNumber: payload.packNumber,
      createDate: payload.createDate,
      startRecordDate: payload.startRecordDate,
      endRecordDate: payload.endRecordDate,
      timeRecordedMs: payload.timeRecordedMs,
      status: payload.status || "recorded",
      createdAt: new Date().toISOString(),
      orderCode: payload.orderCode,
      videoStorage: payload.videoStorage,
      videoStorageKey: payload.videoStorageKey,
      videoFileName: payload.videoFileName,
      videoFileSize: payload.videoFileSize,
      videoMimeType: payload.videoMimeType,
      videoResolution: payload.videoResolution,
      videoFrameRate: payload.videoFrameRate,
      videoChecksum: payload.videoChecksum,
      thumbnailStorage: payload.thumbnailStorage,
      thumbnailStorageKey: payload.thumbnailStorageKey,
      thumbnailBase64: payload.thumbnailBase64,
      thumbnailUrl: payload.thumbnailUrl,
      ip: payload.ip,
      tags: payload.tags,
      notes: payload.notes,
      videoType: payload.videoType || "normal",
    } as PackDoc;
  }

  /**
   * Save recovered packs to local storage
   */
  private async saveRecoveredPacks(packs: PackDoc[]): Promise<void> {
    try {
      // Get existing packs
      const existingPacks = await this.packService.getAllPacks();

      // Filter out videos marked as 'return' for separate storage
      const normalPacks = packs.filter((p) => p.videoType !== "return");
      const returnVideos = packs.filter((p) => p.videoType === "return");

      // Merge and save normal packs
      if (normalPacks.length > 0) {
        // Filter duplicates for normal packs
        const existingNormalIds = new Set(existingPacks.map((p) => p.videoStorageKey).filter((k) => !!k));
        const newNormalPacks = normalPacks.filter((p) => !existingNormalIds.has(p.videoStorageKey));

        if (newNormalPacks.length > 0) {
          const merged = [...existingPacks, ...newNormalPacks];
          await this.packService.saveAllPacks(merged);
          console.log(
            `⏾️ [VideoRecovery] Saved ${newNormalPacks.length} new normal packs (${normalPacks.length - newNormalPacks.length} duplicates filtered)`,
          );
        } else {
          console.log(`⏾️ [VideoRecovery] All ${normalPacks.length} normal packs already exist (duplicates detected)`);
        }
      }

      // Merge and save return videos
      if (returnVideos.length > 0) {
        const existingReturnVideos = await this.packService.getAllReturnVideos();

        // Filter duplicates for return videos by videoStorageKey
        const existingReturnIds = new Set(existingReturnVideos.map((p) => p.videoStorageKey).filter((k) => !!k));
        const newReturnVideos = returnVideos.filter((p) => !existingReturnIds.has(p.videoStorageKey));

        if (newReturnVideos.length > 0) {
          const merged = [...existingReturnVideos, ...newReturnVideos];
          await this.packService.saveAllReturnVideos(merged);
          console.log(
            `⏾️ [VideoRecovery] Saved ${newReturnVideos.length} new return videos (${returnVideos.length - newReturnVideos.length} duplicates filtered)`,
          );
        } else {
          console.log(`⏾️ [VideoRecovery] All ${returnVideos.length} return videos already exist (duplicates detected)`);
        }
      }
    } catch (error) {
      console.error("❌ [VideoRecovery] Failed to save recovered packs:", error);
      throw error;
    }
  }

  /**
   * Extract order code from filename
   * Supports format: PREFIX_ORDERNUMBER_TIMESTAMP.mp4
   * Example: VID_ORDER123_1712345678901.mp4 → ORDER123
   */
  private extractOrderCodeFromFilename(fileName: string): string | undefined {
    try {
      // Remove extension
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

      // Parse format: PREFIX_ORDERNUMBER_TIMESTAMP
      // Example: VID_ORDER123_1712345678901
      const parts = nameWithoutExt.split("_");
      if (parts.length >= 2) {
        // parts[0] = ORDERNUMBER (VID)
        // parts[2] = TIMESTAMP (1712345678901)
        const orderCode = parts[0];
        if (orderCode && orderCode.length > 0) {
          return orderCode;
        }
      }

      // Fallback: if no underscore format, return the whole name
      if (nameWithoutExt.length > 3 && nameWithoutExt.length < 50) {
        return nameWithoutExt;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract filename from media file
   */
  private extractFileName(media: any): string {
    // Try various properties where filename might be stored
    if (media.fileName) return media.fileName;
    if (media.name) return media.name;
    if (media.title) return media.title;

    // Extract from path
    const path = media.path || media.identifier || "";
    const parts = path.split("/");
    return parts[parts.length - 1] || "video.mp4";
  }

  /**
   * Sanitize filename to use as pack number
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, "") // remove extension
      .replace(/[^a-zA-Z0-9_-]/g, "_") // replace invalid chars
      .slice(0, 50); // limit length
  }

  /**
   * Sleep for given milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if recovery was already done for this install
   */
  private async isRecoveryAlreadyDone(): Promise<boolean> {
    try {
      const value = localStorage.getItem(this.RECOVERY_MARKER);
      return value === `v${this.RECOVERY_MARKER_VERSION}`;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark recovery as completed
   */
  private async markRecoveryDone(): Promise<void> {
    try {
      localStorage.setItem(this.RECOVERY_MARKER, `v${this.RECOVERY_MARKER_VERSION}`);
      console.log("📍 [VideoRecovery] Marked recovery as done");
    } catch (error) {
      console.error("❌ [VideoRecovery] Failed to mark recovery done:", error);
    }
  }

  /**
   * Reset recovery marker for testing - allows re-running recovery
   * @param verbose - log the action
   */
  public async resetRecoveryMarker(verbose = true): Promise<void> {
    try {
      localStorage.removeItem(this.RECOVERY_MARKER);
      if (verbose) {
        console.log("🔄 [VideoRecovery] Recovery marker reset - next recovery will run again");
      }
    } catch (error) {
      console.error("❌ [VideoRecovery] Failed to reset recovery marker:", error);
    }
  }

  /**
   * Manually trigger recovery for testing
   */
  public async manualRecovery(): Promise<number> {
    console.log("🔄 [VideoRecovery] Manual recovery triggered");
    // Reset marker to allow re-running
    await this.resetRecoveryMarker(false);
    // Run recovery
    return this.recoverOrphanedVideos();
  }

  /**
   * Generate UUID (same as PackService)
   */
  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get all existing packs (wrapper for testing)
   */
  async getAllPacks(): Promise<PackDoc[]> {
    return this.packService.getAllPacks();
  }

  /**
   * Wrapper for getAllReturnVideos
   */
  async getAllReturnVideos(): Promise<PackDoc[]> {
    return this.packService.getAllReturnVideos();
  }
}
