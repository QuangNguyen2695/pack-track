import { registerPlugin, Capacitor } from "@capacitor/core";

export interface VideoItem {
  _id: string;
  uri: string;
  fileName: string;
  size: number;
  date: number;
  relativePath: string;
}

export interface DeleteMultipleResult {
  success: number;
  fail: number;
}

export interface VideoPlugin {
  getAllVideos(): Promise<{
    videos: VideoItem[];
  }>;
  deleteMultipleByUris(options: { uris: string[] }): Promise<DeleteMultipleResult>;
}

const _Video = registerPlugin<VideoPlugin>("Video");

function isNative() {
  return Capacitor.isNativePlatform();
}

export const Video: VideoPlugin = {
  async getAllVideos() {
    if (!isNative()) throw new Error("Video plugin only available on native.");
    return _Video.getAllVideos();
  },

  async deleteMultipleByUris(options) {
    if (!isNative()) throw new Error("Video plugin only available on native.");
    return _Video.deleteMultipleByUris(options);
  },
};

export default Video;
