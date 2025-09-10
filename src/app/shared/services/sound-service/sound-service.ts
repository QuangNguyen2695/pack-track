import { Injectable } from "@angular/core";

// sound.service.ts
@Injectable({ providedIn: "root" })
export class SoundService {
  private audio?: HTMLAudioElement;

  play(src: string) {
    // vẫn giữ nếu bạn cần gọi không chờ
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.audio = new Audio(src);
    this.audio.play().catch(console.error);
  }

  playAndWait(src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Ngăn chồng chéo: luôn tạo audio mới, dừng cái cũ nếu còn
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }
        const audio = new Audio(src);
        this.audio = audio;

        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
        };

        audio.onended = () => {
          cleanup();
          resolve();
        };
        audio.onerror = (e) => {
          cleanup();
          reject(e);
        };

        // Một số trình duyệt cần user gesture — bạn đã có từ camera/scan
        audio.play().catch((err) => {
          cleanup();
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}
