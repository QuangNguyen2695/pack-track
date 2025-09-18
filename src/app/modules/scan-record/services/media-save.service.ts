import { Injectable } from "@angular/core";
import { Media } from "@capacitor-community/media";

@Injectable({ providedIn: "root" })
export class MediaSaveService {
  private albumId?: string;

  constructor() {}

  async ensureAlbum(name = "PackTrack Videos"): Promise<string> {
    if (this.albumId) return this.albumId;
    let { albums } = await Media.getAlbums();
    let album = albums.find((a) => a.name === name);
    if (!album) {
      await Media.createAlbum({ name });
      ({ albums } = await Media.getAlbums());
      album = albums.find((a) => a.name === name);
    }
    if (!album) throw new Error("Cannot resolve albumIdentifier");
    this.albumId = album.identifier;
    return this.albumId;
  }

  private normalizePath(p: string): string {
    if (!/^file:|^content:|^data:/.test(p)) return "file://" + p;
    return p;
  }

  async saveVideo(originalPath: string, baseName: string, albumName?: string): Promise<string> {
     const albumIdentifier = await this.ensureAlbum(albumName);
    const path = this.normalizePath(originalPath);
    const fileName = baseName.replace(/[^\w\-]+/g, "_").slice(0, 40); // Android: không kèm .mp4

    const saved = await Media.saveVideo({ path, albumIdentifier, fileName });
    return (saved as any)?.filePath || path;
  }
}
