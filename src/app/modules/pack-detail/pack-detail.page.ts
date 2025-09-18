import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem, FilesystemDirectory } from "@capacitor/filesystem";
import { Subscription } from "rxjs";

import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
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
    private credential: CredentialService,
  ) {}

  ngOnInit(): void {
    // 1) Ưu tiên lấy pack từ router state (this.router.navigate(['/pack-detail', r]))
    this.getQueryParams();
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
    this.resolveVideo().finally(() => (this.loading = false));
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
    } catch (e) {
      // Nếu server cần Authorization header, dùng fetch → blob → objectURL
      await this.loadServerWithAuthToBlobUrl();
    }
  }

  /** Nếu server yêu cầu token header → fetch lấy blob và tạo objectURL để phát */
  private async loadServerWithAuthToBlobUrl() {
    try {
      const key = this.pack?.videoStorageKey!;
      const url = /^https?:\/\//i.test(key) ? key : this.buildServerUrlFromKey(key);

      // Lấy token từ credential
      const token = await this.credential.getToken?.();

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.objectUrlForServerFetch = objectUrl;
      this.videoSrcSafe = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
    } catch (err) {
      this.errorMsg = "Không đọc được video từ server";
    }
  }

  // ----------------- Download (server only) -----------------
  async downloadServerVideo() {
    if (this.isLocal || !this.pack?.videoStorageKey) return;

    const key = this.pack.videoStorageKey;
    const url = /^https?:\/\//i.test(key) ? key : this.buildServerUrlFromKey(key);

    try {
      const token = await this.credential.getToken?.();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const blob = await res.blob();
      // Convert blob -> base64 (chú ý: file lớn có thể tốn RAM; cân nhắc Filesystem.downloadFile nếu bạn dùng Capacitor v6+)
      const base64 = await this.blobToBase64(blob);
      const fileName = this.pack.videoFileName || `${this.pack.packNumber || "video"}.mp4`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents, // hoặc Directory.ExternalStorage cho Android (nếu muốn trong Downloads)
        recursive: true,
      });

      // (Tuỳ chọn) show toast "Đã tải về"
    } catch (e) {
      // show toast "Tải thất bại"
    }
  }

  private isHttpUrl(u: string) {
    return /^https?:\/\//i.test(u);
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

  private async ensureMediaReadPermission() {
    try {
      const perm = await Filesystem.checkPermissions();
      // Capacitor v6: publicStorage; v5: có thể là 'photos'/'videos' tùy platform
      if ((perm as any)?.publicStorage !== "granted") {
        await Filesystem.requestPermissions();
      }
    } catch {}
  }

  async sharePack() {
    if (!this.pack) return;
    this.isSharing = true;
    try {
      const can = await Share.canShare().catch(() => ({ value: false }));
      if (!can.value) return;

      const key = this.pack.videoStorageKey; // "/storage/emulated/0/.../859542894044.mp4"
      if (!key) return;

      await this.ensureReadVideoPermission();

      // Quan trọng: đổi sang file:// và encode khoảng trắng
      const fileUrl = this.toFileUrl(key); // "file:///storage/emulated/0/Android/media/io.ionic.starter/PackTrack%20Videos/859542894044.mp4"

      // Gọi share — nhiều bản Share yêu cầu "only file urls are supported"
      await Share.share({
        dialogTitle: "Chia sẻ Video Pack",
        files: [fileUrl],
      });
    } finally {
      this.isSharing = false;
    }
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
    // Encode phần path để tránh lỗi vì khoảng trắng ("PackTrack Videos")
    // encodeURI không thay đổi dấu "/" nên an toàn cho path
    const encoded = encodeURI(absPath);
    return encoded.startsWith("file://") ? encoded : `file://${encoded}`;
  }

  private async ensureReadVideoPermission() {
    if (Capacitor.getPlatform() !== "android") return;
    // Capacitor v5/v6: Filesystem.requestPermissions() sẽ xin READ_MEDIA_* (API 33+)
    // và READ_EXTERNAL_STORAGE (API <=32) nếu cần.
    try {
      await Filesystem.requestPermissions();
    } catch {}
  }
}
