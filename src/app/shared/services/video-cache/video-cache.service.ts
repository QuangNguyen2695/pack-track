import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { PackService } from '../pack-service/pack.service';
import { LoadingService } from '../loadding-service/loading.service';
import { SyncProgressService } from '../sync-progress/sync-progress.service';

export interface CachedVideo {
  id: string;
  payload: any; // Lưu toàn bộ payload để call create() API
  timestamp: number; // Thời gian cache
  retryCount: number; // Số lần thử lại
}

@Injectable({
  providedIn: 'root'
})
export class VideoCacheService {
  private readonly CACHE_KEY = 'cached_videos';
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY_MS = 2000; // 2 giây

  constructor(
    private packService: PackService,
    private loading: LoadingService,
    private syncProgressService: SyncProgressService
  ) {}

  /**
   * Lưu video vào cache khi API call thất bại
   */
  async cacheVideo(payload: any): Promise<void> {
    try {
      const cachedVideos = await this.getCachedVideos();
      
      const newVideo: CachedVideo = {
        id: this.generateId(),
        payload: payload,
        timestamp: Date.now(),
        retryCount: 0
      };

      cachedVideos.push(newVideo);
      
      await Preferences.set({
        key: this.CACHE_KEY,
        value: JSON.stringify(cachedVideos)
      });

      console.log('Video cached successfully:', newVideo.id);
    } catch (error) {
      console.error('Failed to cache video:', error);
    }
  }

  /**
   * Lấy danh sách video đã cache
   */
  async getCachedVideos(): Promise<CachedVideo[]> {
    try {
      const result = await Preferences.get({ key: this.CACHE_KEY });
      
      if (result.value) {
        return JSON.parse(result.value) as CachedVideo[];
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get cached videos:', error);
      return [];
    }
  }

  /**
   * Xóa video khỏi cache
   */
  async removeCachedVideo(videoId: string): Promise<void> {
    try {
      const cachedVideos = await this.getCachedVideos();
      const filteredVideos = cachedVideos.filter(video => video.id !== videoId);
      
      await Preferences.set({
        key: this.CACHE_KEY,
        value: JSON.stringify(filteredVideos)
      });

      console.log('Video removed from cache:', videoId);
    } catch (error) {
      console.error('Failed to remove cached video:', error);
    }
  }

  /**
   * Xóa nhiều video đã sync thành công khỏi cache
   */
  private async removeSyncedVideos(videoIds: string[]): Promise<void> {
    try {
      const cachedVideos = await this.getCachedVideos();
      const filteredVideos = cachedVideos.filter(video => !videoIds.includes(video.id));
      
      await Preferences.set({
        key: this.CACHE_KEY,
        value: JSON.stringify(filteredVideos)
      });

      console.log(`Removed ${videoIds.length} synced videos from cache`);
    } catch (error) {
      console.error('Failed to remove synced videos:', error);
    }
  }

  /**
   * Đồng bộ tất cả video cache với API
   */
  async syncCachedVideos(): Promise<void> {
    const cachedVideos = await this.getCachedVideos();
    
    if (cachedVideos.length === 0) {
      console.log('No cached videos to sync');
      return;
    }

    console.log(`Found ${cachedVideos.length} cached videos to sync`);

    // Bắt đầu progress tracking
    this.syncProgressService.startSync(cachedVideos.length);
    
    let completedCount = 0;
    let failedCount = 0;
    const successfulVideoIds: string[] = [];
    const failedVideosToUpdate: CachedVideo[] = [];
    const videosToRemove: string[] = []; // Videos quá nhiều lần retry

    for (const video of cachedVideos) {
      try {
        // Cập nhật video hiện tại đang sync
        this.syncProgressService.updateProgress(
          completedCount, 
          failedCount, 
          video.payload?.orderCode || 'Unknown'
        );

        const success = await this.syncSingleVideo(video);
        
        if (success) {
          completedCount++;
          successfulVideoIds.push(video.id); // Lưu lại ID video sync thành công
        } else {
          failedCount++;
          // Tăng retry count cho video thất bại
          video.retryCount += 1;
          
          if (video.retryCount >= this.MAX_RETRY_COUNT) {
            console.warn(`Video ${video.id} failed ${this.MAX_RETRY_COUNT} times, will be removed from cache`);
            videosToRemove.push(video.id);
          } else {
            failedVideosToUpdate.push(video);
          }
        }

        // Cập nhật progress
        this.syncProgressService.updateProgress(completedCount, failedCount);
        
        // Delay giữa các lần sync để tránh spam API
        await this.delay(this.RETRY_DELAY_MS);
        
      } catch (error) {
        console.error(`Failed to sync video ${video.id}:`, error);
        failedCount++;
        
        // Tăng retry count cho video có exception
        video.retryCount += 1;
        if (video.retryCount >= this.MAX_RETRY_COUNT) {
          videosToRemove.push(video.id);
        } else {
          failedVideosToUpdate.push(video);
        }
        
        this.syncProgressService.updateProgress(completedCount, failedCount);
      }
    }

    // Xóa những video sync thành công khỏi cache
    if (successfulVideoIds.length > 0) {
      await this.removeSyncedVideos(successfulVideoIds);
      console.log(`Removed ${successfulVideoIds.length} successfully synced videos from cache`);
    }

    // Xóa những video failed quá nhiều lần
    if (videosToRemove.length > 0) {
      await this.removeSyncedVideos(videosToRemove);
      console.log(`Removed ${videosToRemove.length} videos that failed too many times`);
    }

    // Cập nhật retry count cho những video vẫn còn cơ hội retry
    if (failedVideosToUpdate.length > 0) {
      await this.updateFailedVideos(failedVideosToUpdate);
      console.log(`Updated retry count for ${failedVideosToUpdate.length} failed videos`);
    }

    // Hoàn thành sync - cache các video failed sẽ được giữ lại để retry sau
    this.syncProgressService.completeSync();
  }

  /**
   * Đồng bộ một video cụ thể với API
   */
  private async syncSingleVideo(video: CachedVideo): Promise<boolean> {
    try {
      // Bỏ qua kiểm tra file exists vì có thể báo lỗi sai
      // Để API tự xử lý nếu file không tồn tại
      
      // Thử gọi API create với payload đã cache
      const success = await this.saveVideoToAPI(video);
      
      if (success) {
        console.log(`Video synced successfully: ${video.id}`);
        return true;
      } else {
        console.warn(`Failed to sync video ${video.id}, will retry later`);
        return false;
      }
      
    } catch (error) {
      console.error(`Failed to sync video ${video.id}:`, error);
      return false;
    }
  }

  /**
   * Gọi API để save video
   */
  private async saveVideoToAPI(video: CachedVideo): Promise<boolean> {
    try {
      // Sử dụng method create() có sẵn với payload đã cache
      const result = await this.packService.create(video.payload, true).toPromise();
      
      // Kiểm tra kết quả: nếu trả về PackDoc object với _id thì thành công
      return !!(result && result._id);
      
    } catch (error) {
      console.error('API call failed:', error);
      return false;
    }
  }

  /**
   * Kiểm tra file có tồn tại không
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: filePath,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Đồng bộ trong background với progress widget
   */
  async syncWithLoading(): Promise<void> {
    const cachedVideos = await this.getCachedVideos();
    
    if (cachedVideos.length === 0) {
      return;
    }

    try {
      await this.syncCachedVideos();
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncProgressService.setError();
    }
  }

  /**
   * Lấy số lượng video chưa đồng bộ
   */
  async getPendingSyncCount(): Promise<number> {
    const cachedVideos = await this.getCachedVideos();
    return cachedVideos.length;
  }

  /**
   * Xóa tất cả cache (sử dụng trong trường hợp emergency)
   */
  async clearAllCache(): Promise<void> {
    try {
      await Preferences.remove({ key: this.CACHE_KEY });
      console.log('All cached videos cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Cập nhật retry count cho những video failed
   */
  private async updateFailedVideos(failedVideos: CachedVideo[]): Promise<void> {
    try {
      const allCachedVideos = await this.getCachedVideos();
      
      // Update retry count trong array
      for (const failedVideo of failedVideos) {
        const index = allCachedVideos.findIndex(v => v.id === failedVideo.id);
        if (index !== -1) {
          allCachedVideos[index].retryCount = failedVideo.retryCount;
        }
      }
      
      // Save updated array back to storage
      await Preferences.set({
        key: this.CACHE_KEY,
        value: JSON.stringify(allCachedVideos)
      });

      console.log('Updated retry count for failed videos');
    } catch (error) {
      console.error('Failed to update failed videos:', error);
    }
  }

  // Helper methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}