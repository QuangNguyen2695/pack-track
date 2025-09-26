import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { VideoCacheService } from '../../../shared/services/video-cache/video-cache.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [CommonModule, FormsModule, IonicModule],
})
export class HomePage implements OnInit {
  constructor(
    private videoCacheService: VideoCacheService,
    private toastController: ToastController
  ) {}

  ngOnInit() {}

  async addTestVideoToCache() {
    const fakeVideo = {
      id: `test-video-${Date.now()}`,
      title: 'Test Video Cache',
      description: 'Fake video để test sync widget',
      videoPath: '/fake/path/test-video.mp4',
      thumbnail: '/fake/path/thumbnail.jpg',
      barcode: '1234567890',
      location: 'Test Location',
      createdAt: new Date().toISOString()
    };

    try {
      await this.videoCacheService.cacheVideo(fakeVideo);
      
      const toast = await this.toastController.create({
        message: '✅ Đã thêm test video vào cache!',
        duration: 2000,
        position: 'top',
        color: 'success'
      });
      await toast.present();
      
    } catch (error) {
      const toast = await this.toastController.create({
        message: '❌ Lỗi khi thêm video vào cache',
        duration: 2000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    }
  }
}
