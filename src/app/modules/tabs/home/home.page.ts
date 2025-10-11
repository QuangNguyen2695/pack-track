import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { VideoCacheService } from "../../../shared/services/video-cache/video-cache.service";
import { ToastController } from "@ionic/angular";
import { AdmobService } from "@rsApp/shared/services/admob-service/dmob.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.page.html",
  styleUrls: ["./home.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class HomePage implements OnInit {
  loading = false;
  showing = false;
  status = "idle";
  reward: { type: string; amount: number } | null = null;
  error: string | null = null;

  constructor(private videoCacheService: VideoCacheService, private toastController: ToastController, private ads: AdmobService) {}

  async ngOnInit() {
    await this.ads.init();
  }

  async ionViewWillEnter() {
    await this.ads.showBanner(false); // banner dưới
    await this.ads.preloadInterstitial(); // nạp sẵn
    await this.ads.preloadRewarded(); // nạp sẵn
  }

  async preload() {
    this.loading = true;
    this.error = null;
    this.status = "preloading…";
    try {
      await this.ads.preloadRewarded();
      this.status = "preloaded ✅";
    } catch (e: any) {
      this.error = e?.message || String(e);
      this.status = "preload failed";
    } finally {
      this.loading = false;
    }
  }

  async show() {
    this.showing = true;
    this.error = null;
    this.reward = null;
    this.status = "showing…";
    try {
      // showRewarded() trong service trả về AdMobRewardItem | null
      const r = await this.ads.showRewarded();
      if (r) {
        this.reward = r;
        this.status = "rewarded ✅";
      } else {
        this.status = "closed (no reward)";
      }
    } catch (e: any) {
      this.error = e?.message || String(e);
      this.status = "show failed";
    } finally {
      this.showing = false;
    }
  }

  async addTestVideoToCache() {
    const fakeVideo = {
      id: `test-video-${Date.now()}`,
      title: "Test Video Cache",
      description: "Fake video để test sync widget",
      videoPath: "/fake/path/test-video.mp4",
      thumbnail: "/fake/path/thumbnail.jpg",
      barcode: "1234567890",
      location: "Test Location",
      createdAt: new Date().toISOString(),
    };

    try {
      await this.videoCacheService.cacheVideo(fakeVideo);

      const toast = await this.toastController.create({
        message: "✅ Đã thêm test video vào cache!",
        duration: 2000,
        position: "top",
        color: "success",
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: "❌ Lỗi khi thêm video vào cache",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await toast.present();
    }
  }
}
