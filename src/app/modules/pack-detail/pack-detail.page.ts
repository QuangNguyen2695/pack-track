import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem, FilesystemDirectory } from "@capacitor/filesystem";
import { Subscription } from "rxjs";

import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { PackDoc } from "@rsApp/shared/models/pack.model";
import { Share } from "@capacitor/share";
import { toast } from "ngx-sonner";

@Component({
  selector: "app-pack-detail",
  templateUrl: "./pack-detail.page.html",
  styleUrls: ["./pack-detail.page.scss"],
  standalone: false,
})
export class PackDetailPage implements OnInit, OnDestroy {
  @ViewChild("videoEl", { static: false }) videoEl!: ElementRef<HTMLVideoElement>;

  pack?: PackDoc;
  videoSrcSafe?: SafeResourceUrl;
  isLocal = false; // video local hay server
  loading = true;
  errorMsg = "";

  // Return videos
  returnVideos: PackDoc[] = [];
  loadingReturnVideos = false;
  // Normal videos (when viewing return video)
  normalVideos: PackDoc[] = [];
  loadingNormalVideos = false;
  isViewingReturnVideo = false; // Flag to indicate if we're viewing a return video

  // custom controls state
  isPlaying = false;
  curTime = 0;
  duration = 0;

  private subs = new Subscription();
  private objectUrlForServerFetch?: string; // để revoke sau

  isSharing = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private packService: PackService,
  ) {}

  ngOnInit(): void {
    // 1) Ưu tiên lấy pack từ router state (this.router.navigate(['/pack-detail', r]))
    this.getQueryParams();
  }

  ionViewWillEnter(): void {
    // Re-check query params on every route entry (needed for same-route navigation)
    this.getQueryParams();

    // Reload return videos when entering the page if viewing normal video
    if (!this.isViewingReturnVideo && this.pack?.orderCode) {
      console.log(`📦 [PackDetail] Reloading return videos on view enter`);
      this.loadReturnVideos();
    }
    // Reload normal videos when entering the page if viewing return video
    if (this.isViewingReturnVideo && this.pack?.orderCode) {
      console.log(`🎥 [PackDetail] Reloading normal videos on view enter`);
      this.loadNormalVideos();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.objectUrlForServerFetch) {
      URL.revokeObjectURL(this.objectUrlForServerFetch);
    }
  }

  async getQueryParams() {
    const params = history.state;
    if (!params || !params["pack"]) {
      this.router.navigate(["/tabs/pack"]);
      return;
    }
    this.pack = params["pack"] ? params["pack"] : null;

    // Check if viewing a return video
    this.isViewingReturnVideo = this.pack?.videoType === "return";
    console.log(`📦 [PackDetail] Viewing pack: ${this.pack?.packNumber}, isReturnVideo: ${this.isViewingReturnVideo}`);

    this.resolveVideo().finally(() => (this.loading = false));

    // Load return videos only if viewing a normal video
    if (!this.isViewingReturnVideo && this.pack?.orderCode) {
      this.loadReturnVideos();
    }

    // Load normal videos only if viewing a return video
    if (this.isViewingReturnVideo && this.pack?.orderCode) {
      this.loadNormalVideos();
    }
  }

  async loadReturnVideos() {
    if (!this.pack?.orderCode) return;

    this.loadingReturnVideos = true;
    try {
      this.packService.getReturnVideosByOrderCode(this.pack.orderCode).subscribe({
        next: (videos) => {
          this.returnVideos = videos;
          console.log(`📦 [PackDetail] Loaded ${videos.length} return videos for order: ${this.pack?.orderCode}`);
        },
        error: (err) => {
          console.error("❌ [PackDetail] Failed to load return videos:", err);
          this.returnVideos = [];
        },
      });
    } finally {
      this.loadingReturnVideos = false;
    }
  }

  async loadNormalVideos() {
    if (!this.pack?.orderCode) return;

    this.loadingNormalVideos = true;
    try {
      this.packService.getNormalVideosByOrderCode(this.pack.orderCode).subscribe({
        next: (videos) => {
          this.normalVideos = videos;
          console.log(`🎥 [PackDetail] Loaded ${videos.length} normal videos for order: ${this.pack?.orderCode}`);
        },
        error: (err) => {
          console.error("❌ [PackDetail] Failed to load normal videos:", err);
          this.normalVideos = [];
        },
      });
    } finally {
      this.loadingNormalVideos = false;
    }
  }

  // ----------------- Player events -----------------
  onLoadedMetadata() {
    const v = this.videoEl?.nativeElement;
    if (!v) return;
    this.duration = v.duration || 0;
  }

  onTimeUpdate() {
    const v = this.videoEl?.nativeElement;
    if (!v) return;
    this.curTime = v.currentTime || 0;
  }

  togglePlay() {
    const v = this.videoEl?.nativeElement;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => (this.isPlaying = true))
        .catch(() => {});
    } else {
      v.pause();
      this.isPlaying = false;
    }
  }

  onSeek(ev: CustomEvent) {
    const v = this.videoEl?.nativeElement;
    if (!v) return;
    const to = Number((ev.detail as any).value || 0);
    v.currentTime = to;
  }

  // ----------------- Resolve video source -----------------
  private async resolveVideo() {
    try {
      const key = this.pack?.videoStorageKey;
      if (!key) {
        this.errorMsg = "Pack chưa có video";
        return;
      }

      // Local?
      if (this.isLocalKey(key) || this.pack?.videoStorage === "local") {
        this.isLocal = true;
        const src = Capacitor.convertFileSrc(key);
        this.videoSrcSafe = this.sanitizer.bypassSecurityTrustResourceUrl(src);
        return;
      }

      // Server?
      this.isLocal = false;

      // Nếu key đã là URL http(s) → dùng trực tiếp
      if (/^https?:\/\//i.test(key)) {
        this.videoSrcSafe = this.sanitizer.bypassSecurityTrustResourceUrl(key);
        return;
      }

      // Nếu key là path tương đối → tự build URL (tuỳ BE của bạn)
      // TODO: nếu BE của bạn trả presigned URL riêng, bạn gọi API đó để lấy URL trực tiếp.
      const serverUrl = this.buildServerUrlFromKey(key); // bạn sửa hàm này cho khớp BE
      // Thử dùng trực tiếp:
      this.videoSrcSafe = this.sanitizer.bypassSecurityTrustResourceUrl(serverUrl);
    } catch (e) {}
  }

  private isLocalKey(u: string) {
    return u.startsWith("file://") || u.startsWith("content://");
  }

  /** Nếu server của bạn trả đường dẫn tương đối, build thành URL đầy đủ tại đây */
  private buildServerUrlFromKey(key: string): string {
    // TODO: đổi theo BE của bạn (ví dụ: `${environment.apiBase}/files/stream?key=${encodeURIComponent(key)}`)
    return key;
  }

  /** (tuỳ chọn) lấy presigned URL từ BE nếu cần share public link */
  private async getPresignedUrlForShare(packId: string): Promise<string | null> {
    // TODO: gọi API của bạn để lấy URL share tạm thời; nếu chưa có, trả null
    return null;
  }

  async sharePack() {
    if (!this.pack) return;
    this.isSharing = true;
    let tempCacheFile: string | undefined;
    try {
      const can = await Share.canShare().catch(() => ({ value: false }));
      if (!can.value) {
        toast.error("❌ Chia sẻ không được hỗ trợ trên thiết bị này");
        return;
      }

      const key = this.pack.videoStorageKey;
      if (!key) {
        toast.error("❌ Video chưa sẵn sàng để chia sẻ");
        return;
      }

      const packTitle = this.pack.packNumber || "Video Pack";
      const shareText = `📦 PackTrack: ${packTitle}\n\n🎥 Chia sẻ video từ ứng dụng PackTrack`;

      console.log("🔗 [Share] Starting video share process...");
      console.log("📝 [Share] Video storage key:", key.substring(0, 50));

      // Copy video to cache for sharing (required for Messenger, Zalo compatibility)
      tempCacheFile = await this.copyVideoToCacheForSharing(key);

      if (!tempCacheFile) {
        toast.error("❌ Không thể chuẩn bị video để chia sẻ");
        return;
      }

      console.log("✅ [Share] Video copied to cache:", tempCacheFile);

      // Share from cache location
      await Share.share({
        title: packTitle,
        text: shareText,
        dialogTitle: "Chia sẻ Video",
        files: [tempCacheFile], // File path in cache accessible to other apps
      });

      console.log("✅ [Share] Share dialog opened successfully");
      toast.success("✅ Video được gửi!");
    } catch (error: any) {
      console.error("❌ [Share] Share error:", error);

      if (error?.code === 6) {
        toast.error("❌ Không có ứng dụng để chia sẻ");
        console.error("Share cancelled or no apps available");
      } else {
        toast.error("❌ Không thể chia sẻ video. Vui lòng kiểm tra quyền.");
        console.error("Share error details:", {
          message: error?.message,
          code: error?.code,
          domain: error?.domain,
        });
      }
    } finally {
      this.isSharing = false;
      // Cleanup temp cache file after a delay (allow Share to complete)
      if (tempCacheFile) {
        setTimeout(() => this.cleanupCacheFile(tempCacheFile!), 2000);
      }
    }
  }

  /**
   * Copy video to app cache directory for sharing
   * This makes it accessible to other apps via Share API
   */
  private async copyVideoToCacheForSharing(videoKey: string): Promise<string | undefined> {
    try {
      const fileName = this.pack?.videoFileName || `${this.pack?.packNumber || "video"}.mp4`;

      console.log("📋 [Share] Preparing video for sharing:", fileName);

      // Read video file
      let videoData: string;

      if (videoKey.startsWith("content://") || videoKey.startsWith("file://")) {
        // For MediaStore or file URIs, read using Filesystem
        try {
          // Try to read as URI directly first
          const readResult = await Filesystem.readFile({
            path: videoKey,
          }).catch(() => null);

          if (readResult?.data) {
            videoData = readResult.data as string;
            console.log("✅ Read video from URI, size:", (videoData.length / 1024 / 1024).toFixed(2), "MB");
          } else {
            // Fallback: try fetching via file URI
            const response = await fetch(Capacitor.convertFileSrc(videoKey));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            videoData = await this.blobToBase64(blob);
            console.log("✅ Fetched video from file URI, size:", (videoData.length / 1024 / 1024).toFixed(2), "MB");
          }
        } catch (e) {
          console.warn("⚠️ Could not read from URI, trying direct path:", e);
          // Try as direct filesystem path
          const readResult = await Filesystem.readFile({
            path: videoKey.replace(/^file:\/\//, "").replace(/^content:\/\//, ""),
            directory: Directory.ExternalStorage,
          }).catch(() => null);

          if (!readResult?.data) {
            throw new Error("Could not read video file");
          }
          videoData = readResult.data as string;
        }
      } else {
        // Assume it's a path relative to ExternalStorage or Documents
        const readResult = await Filesystem.readFile({
          path: videoKey,
          directory: Directory.ExternalStorage,
        }).catch(() => null);

        if (!readResult?.data) {
          throw new Error("Could not read video file from storage");
        }
        videoData = readResult.data as string;
      }

      // Write to cache directory (accessible to Share API)
      const cacheFileName = `share_${Date.now()}_${fileName}`;
      console.log("📝 [Share] Writing to cache:", cacheFileName);

      await Filesystem.writeFile({
        path: cacheFileName,
        data: videoData,
        directory: Directory.Cache, // Use Cache directory for sharing
        recursive: true,
      });

      // Get the full path for sharing
      const cacheDir = await Filesystem.getUri({
        directory: Directory.Cache,
        path: cacheFileName,
      });

      console.log("✅ [Share] Video ready in cache:", cacheDir.uri);
      return cacheDir.uri; // Return the proper URI
    } catch (error) {
      console.error("❌ [Share] Failed to copy video to cache:", error);
      return undefined;
    }
  }

  /**
   * Clean up temporary cache file
   */
  private async cleanupCacheFile(cacheFile: string): Promise<void> {
    try {
      // Extract filename from URI
      const fileName = cacheFile.split("/").pop();
      if (fileName) {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
        console.log("🧹 [Share] Cleaned up cache file:", fileName);
      }
    } catch (error) {
      console.warn("⚠️ [Share] Failed to cleanup cache file:", error);
      // Non-critical, ignore
    }
  }

  recordReturnVideo() {
    if (!this.pack) return;

    const packId = this.pack._id;
    const orderCode = this.pack.orderCode || this.pack.packNumber;

    console.log(`🎥 [PackDetail] Recording return video for pack: ${packId}, order: ${orderCode}`);

    // Navigate to scan-record with params
    this.router.navigate(["/scan-record"], {
      state: {
        recordMode: "return", // Mark as return video
        sourcePackId: packId, // Source pack ID
        orderCode: orderCode, // Order code to pre-fill
      },
    });
  }

  openReturnVideoDetail(returnVideo: PackDoc) {
    if (!returnVideo) return;
    console.log(`📦 [PackDetail] Opening return video: ${returnVideo._id}`);
    this.router.navigate(["/pack-return-detail"], {
      state: { pack: returnVideo },
    });
  }

  openNormalVideoDetail(normalVideo: PackDoc) {
    if (!normalVideo) return;
    console.log(`🎥 [PackDetail] Opening normal video: ${normalVideo._id}`);
    this.router.navigate(["/pack-detail"], {
      state: { pack: normalVideo },
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read error"));
      reader.onload = () => {
        const res = (reader.result as string) || "";
        // FileSystem.writeFile cần chuỗi base64 không kèm prefix
        const pure = res.startsWith("data:") ? res.split(",")[1] : res;
        resolve(pure);
      };
      reader.readAsDataURL(blob);
    });
  }

  // ----------------- Helpers -----------------
  fmtDuration(ms?: number): string {
    const totalSec = Math.floor((ms || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v: number) => (v < 10 ? "0" + v : String(v));
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  private toFileUrl(absPath: string): string {
    // Handle different formats
    if (absPath.startsWith("file://")) {
      return absPath;
    }
    if (absPath.startsWith("content://")) {
      return absPath;
    }

    // For absolute file paths (/storage/...), create proper file:// URI
    // Note: Android Share will convert this to content:// URI automatically
    if (absPath.startsWith("/")) {
      // Use encodeURI which is safer - it encodes special chars but preserves /
      const encoded = encodeURI(absPath);
      return `file://${encoded}`;
    }

    // Fallback
    return absPath.startsWith("file://") ? absPath : `file://${absPath}`;
  }

  onThumbnailLoad(packId: string): void {
    console.log(`✅ Thumbnail loaded for pack: ${packId}`);
  }

  onThumbnailError(packId: string, event: any): void {
    console.error(`❌ Thumbnail failed for pack: ${packId}`, event);
    event.target.style.display = "none";
  }

  getThumbnailUrl(thumbnailBase64?: string, thumbnailUrl?: string): string {
    if (!thumbnailBase64 && !thumbnailUrl) return "";

    // Ưu tiên URL nếu có
    if (thumbnailUrl && thumbnailUrl.startsWith("http")) {
      console.log("📸 Using thumbnail URL:", thumbnailUrl?.substring(0, 50));
      return thumbnailUrl;
    }

    // Nếu là base64
    if (thumbnailBase64) {
      try {
        // Xử lý prefix nếu có
        let b64 = thumbnailBase64.trim();
        console.log("📸 Thumbnail base64 length:", b64.length, "starts with:", b64.substring(0, 30));

        // Nếu đã có prefix, trả về ngay
        if (b64.startsWith("data:image")) {
          console.log("✅ Base64 already has prefix, using as-is");
          return b64;
        }

        // Nếu chưa có prefix, thêm vào
        if (!b64.includes("base64,")) {
          b64 = `data:image/jpeg;base64,${b64}`;
          console.log("✅ Added base64 prefix, total length:", b64.length);
          return b64;
        }

        console.log("✅ Base64 has partial prefix?, returning as-is");
        return b64;
      } catch (e) {
        console.error("❌ Failed to process thumbnail base64:", e);
        return "";
      }
    }

    return "";
  }
}
