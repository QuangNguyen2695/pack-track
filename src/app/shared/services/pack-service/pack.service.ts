import { Injectable } from "@angular/core";
import { Storage } from "@ionic/storage-angular";
import { from } from "rxjs";
import { PackCreatePayload, PackDoc } from "@rsApp/shared/models/pack.model";
import { Video } from "../../../../plugin/VideoScanner";

@Injectable({ providedIn: "root" })
export class PackService {
  private storageKey = "packs";
  private returnVideosStorageKey = "return_videos"; // Separate storage for return videos
  private storage: Storage | null = null;

  constructor(private ionicStorage: Storage) {
    this.init();
  }

  async init() {
    this.storage = await this.ionicStorage.create();
  }

  /** lấy toàn bộ pack */
  async getAllPacks(): Promise<PackDoc[]> {
    const packs = await this.storage?.get(this.storageKey);
    return packs || [];
  }

  /** lưu toàn bộ pack */
  async saveAllPacks(packs: PackDoc[]): Promise<void> {
    console.log("🚀 ~ PackService ~ saveAllPacks ~ packs:", packs);
    await this.storage?.set(this.storageKey, packs);
  }

  /** lấy toàn bộ return videos */
  async getAllReturnVideos(): Promise<PackDoc[]> {
    const videos = await this.storage?.get(this.returnVideosStorageKey);
    return videos || [];
  }

  /** lưu toàn bộ return videos */
  async saveAllReturnVideos(videos: PackDoc[]): Promise<void> {
    console.log("🚀 ~ PackService ~ saveAllReturnVideos ~ videos:", videos);
    await this.storage?.set(this.returnVideosStorageKey, videos);
  }

  /** CREATE */
  create(payload: PackCreatePayload) {
    return from(this.createPack(payload));
  }

  createPackReturn(payload: PackCreatePayload) {
    return from(this.createReturnVideoPack(payload));
  }

  private async createReturnVideoPack(payload: PackCreatePayload): Promise<PackDoc> {
    const videos = await this.getAllReturnVideos();

    const newPack: PackDoc = {
      ...payload,
      _id: this.generateUUID(),
      deviceId: payload.deviceId,
      packNumber: payload.packNumber,
      createDate: payload.createDate,
      startRecordDate: payload.startRecordDate,
      endRecordDate: payload.endRecordDate,
      timeRecordedMs: payload.timeRecordedMs,
      status: payload.status || "recorded",
      createdAt: new Date().toISOString(),
      videoType: "return",
    };

    videos.push(newPack);

    await this.saveAllReturnVideos(videos);
    console.log(`📦 [PackService] Return video created: ${newPack._id} for order ${newPack.orderCode}`);

    return newPack;
  }

  private async createPack(payload: PackCreatePayload): Promise<PackDoc> {
    const packs = await this.getAllPacks();

    const newPack: PackDoc = {
      ...payload,
      _id: this.generateUUID(),
      deviceId: payload.deviceId,
      packNumber: payload.packNumber,
      createDate: payload.createDate,
      startRecordDate: payload.startRecordDate,
      endRecordDate: payload.endRecordDate,
      timeRecordedMs: payload.timeRecordedMs,
      status: payload.status || "recorded",
      createdAt: new Date().toISOString(),
    };

    packs.push(newPack);

    await this.saveAllPacks(packs);

    return newPack;
  }

  /** Generate UUID with fallback for platforms without crypto.randomUUID */
  private generateUUID(): string {
    try {
      // Try native crypto.randomUUID first (modern browsers & Node 15+)
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: generate UUID v4 manually
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** UPDATE */
  update(id: string, patch: Partial<PackCreatePayload>) {
    return from(this.updatePack(id, patch));
  }

  private async updatePack(id: string, patch: Partial<PackCreatePayload>) {
    const packs = await this.getAllPacks();

    const index = packs.findIndex((p) => p._id === id);

    if (index === -1) return null;

    packs[index] = {
      ...packs[index],
      ...patch,
    };

    await this.saveAllPacks(packs);

    return packs[index];
  }

  /** MARK VERIFIED */
  markVerified(id: string) {
    return from(this.markVerifiedPack(id));
  }

  private async markVerifiedPack(id: string) {
    const packs = await this.getAllPacks();

    const index = packs.findIndex((p) => p._id === id);

    if (index === -1) return null;

    packs[index].status = "verified";

    await this.saveAllPacks(packs);

    return packs[index];
  }

  /** GET BY ID */
  getById(id: string) {
    return from(this.getPackById(id));
  }

  private async getPackById(id: string) {
    const packs = await this.getAllPacks();

    return packs.find((p) => p._id === id) || null;
  }

  /** DELETE - Normal Packs */
  removeNormalPacks(ids: string | string[]) {
    return from(this.removeNormalPacksAsync(ids));
  }

  private async removeNormalPacksAsync(ids: string | string[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];

    if (idArray.length === 0) {
      console.log("⚠️ [PackService] No normal pack IDs to delete");
      return { success: true, deletedCount: 0 };
    }

    let normalPacks = await this.getAllPacks();
    const packsToDelete = normalPacks.filter((p) => idArray.includes(p._id));

    console.log(`🗑️ [PackService] Deleting ${packsToDelete.length} normal packs`);

    // Collect URIs from normal packs
    const urisToDelete = packsToDelete
      .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
      .map((pack) => pack.videoStorageKey!)
      .filter((uri) => uri != null && uri !== "");

    // Delete video files
    if (urisToDelete.length > 0) {
      await this.deleteMultipleVideoFiles(urisToDelete);
    }

    // Remove from storage
    normalPacks = normalPacks.filter((p) => !idArray.includes(p._id));
    await this.saveAllPacks(normalPacks);

    console.log(`✅ [PackService] Deleted ${packsToDelete.length} normal packs and ${urisToDelete.length} video files`);

    return { success: true, deletedCount: packsToDelete.length };
  }

  /** DELETE - Return Videos */
  removeReturnVideos(ids: string | string[]) {
    return from(this.removeReturnVideosAsync(ids));
  }

  private async removeReturnVideosAsync(ids: string | string[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];

    if (idArray.length === 0) {
      console.log("⚠️ [PackService] No return video IDs to delete");
      return { success: true, deletedCount: 0 };
    }

    let returnVideos = await this.getAllReturnVideos();
    const videosToDelete = returnVideos.filter((p) => idArray.includes(p._id));

    console.log(`🗑️ [PackService] Deleting ${videosToDelete.length} return videos`);

    // Collect URIs from return videos
    const urisToDelete = videosToDelete
      .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
      .map((pack) => pack.videoStorageKey!)
      .filter((uri) => uri != null && uri !== "");

    // Delete video files
    if (urisToDelete.length > 0) {
      await this.deleteMultipleVideoFiles(urisToDelete);
    }

    // Remove from storage
    returnVideos = returnVideos.filter((p) => !idArray.includes(p._id));
    await this.saveAllReturnVideos(returnVideos);

    console.log(`✅ [PackService] Deleted ${videosToDelete.length} return videos and ${urisToDelete.length} video files`);

    return { success: true, deletedCount: videosToDelete.length };
  }

  /** DELETE - Both (Legacy, calls appropriate method based on video type) */
  remove(ids: string | string[]) {
    return from(this.removePack(ids));
  }

  /**
   * Calculate number of videos that would be deleted before a specific date
   * @param beforeDate - Calculate for videos before this date
   */
  async getVideosBeforeCount(beforeDate: Date): Promise<number> {
    try {
      const normalPacks = await this.getAllPacks();
      const returnVideos = await this.getAllReturnVideos();

      const normalCount = normalPacks.filter((p) => new Date(p.createdAt) < beforeDate).length;
      const returnCount = returnVideos.filter((p) => new Date(p.createdAt) < beforeDate).length;

      console.log(
        `📊 [PackService] Videos before ${beforeDate.toLocaleDateString()}: ${normalCount} normal + ${returnCount} return = ${normalCount + returnCount} total`,
      );

      return normalCount + returnCount;
    } catch (error) {
      console.error(`❌ [PackService] Error calculating videos before date:`, error);
      return 0;
    }
  }

  /**
   * Delete all videos created BEFORE a specific date
   * @param beforeDate - Delete all videos created before this date
   */
  deleteVideosBefore(beforeDate: Date) {
    return from(this.deleteVideosBeforeAsync(beforeDate));
  }

  private async deleteVideosBeforeAsync(beforeDate: Date) {
    try {
      console.log(`🗑️ [PackService] Deleting videos before date: ${beforeDate.toISOString()}`);

      // Get both normal and return videos
      let normalPacks = await this.getAllPacks();
      let returnVideos = await this.getAllReturnVideos();

      // Find packs created before the specified date
      const normalPacksToDelete = normalPacks.filter((p) => {
        const createdDate = new Date(p.createdAt);
        return createdDate < beforeDate;
      });

      const returnVideosToDelete = returnVideos.filter((p) => {
        const createdDate = new Date(p.createdAt);
        return createdDate < beforeDate;
      });

      const totalToDelete = normalPacksToDelete.length + returnVideosToDelete.length;
      console.log(
        `🗑️ [PackService] Found ${normalPacksToDelete.length} normal + ${returnVideosToDelete.length} return videos to delete before ${beforeDate.toLocaleDateString()}`,
      );

      // Collect IDs and URIs from both
      const idsToDelete = [
        ...normalPacksToDelete.map((p) => p._id),
        ...returnVideosToDelete.map((p) => p._id),
      ];

      const urisToDelete = [
        ...normalPacksToDelete
          .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
          .map((pack) => pack.videoStorageKey!),
        ...returnVideosToDelete
          .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
          .map((pack) => pack.videoStorageKey!),
      ].filter((uri) => uri != null && uri !== "");

      // Delete video files
      if (urisToDelete.length > 0) {
        await this.deleteMultipleVideoFiles(urisToDelete);
      }

      // Remove from both storages
      normalPacks = normalPacks.filter((p) => !idsToDelete.includes(p._id));
      returnVideos = returnVideos.filter((p) => !idsToDelete.includes(p._id));

      await this.saveAllPacks(normalPacks);
      await this.saveAllReturnVideos(returnVideos);

      console.log(`✅ [PackService] Deleted ${totalToDelete} videos before ${beforeDate.toLocaleDateString()} and ${urisToDelete.length} video files`);

      return { success: true, deletedCount: totalToDelete };
    } catch (error) {
      console.error(`❌ [PackService] Error deleting videos before date:`, error);
      return { success: false, deletedCount: 0 };
    }
  }

  private async removePack(ids: string | string[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];

    if (idArray.length === 0) {
      console.log("⚠️ [PackService] No IDs to delete");
      return { success: true, deletedCount: 0 };
    }

    // Get both normal and return videos
    let normalPacks = await this.getAllPacks();
    let returnVideos = await this.getAllReturnVideos();

    // Find packs to delete from both storages
    const normalPacksToDelete = normalPacks.filter((p) => idArray.includes(p._id));
    const returnVideosToDelete = returnVideos.filter((p) => idArray.includes(p._id));

    const totalToDelete = normalPacksToDelete.length + returnVideosToDelete.length;
    console.log(`🗑️ [PackService] Found ${normalPacksToDelete.length} normal + ${returnVideosToDelete.length} return videos to delete from ${idArray.length} IDs`);

    // Collect URIs from both normal and return videos
    const urisToDelete = [
      ...normalPacksToDelete
        .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
        .map((pack) => pack.videoStorageKey!),
      ...returnVideosToDelete
        .filter((pack) => pack.videoStorage === "local" && pack.videoStorageKey?.startsWith("content://"))
        .map((pack) => pack.videoStorageKey!),
    ].filter((uri) => uri != null && uri !== "");

    // Delete video files
    if (urisToDelete.length > 0) {
      await this.deleteMultipleVideoFiles(urisToDelete);
    }

    // Remove from both storages
    normalPacks = normalPacks.filter((p) => !idArray.includes(p._id));
    returnVideos = returnVideos.filter((p) => !idArray.includes(p._id));

    await this.saveAllPacks(normalPacks);
    await this.saveAllReturnVideos(returnVideos);

    console.log(`✅ [PackService] Deleted ${totalToDelete} packs and ${urisToDelete.length} video files`);

    return { success: true, deletedCount: totalToDelete };
  }

  private async deleteMultipleVideoFiles(uris: string[]): Promise<void> {
    try {
      console.log(`🗑️ [PackService] Batch deleting ${uris.length} videos`);

      const result = await Video.deleteMultipleByUris({
        uris,
      });

      console.log(`📊 [PackService] Batch delete result: ${result.success}/${uris.length}`);

      if (result.success > 0) {
        console.log(`✅ [PackService] Successfully deleted ${result.success} videos`);
      }

      if (result.fail > 0) {
        console.warn(`⚠️ [PackService] Failed to delete ${result.fail} videos`);
      }
    } catch (error) {
      console.error(`❌ [PackService] Error in batch deletion: ${error}`);
    }
  }

  /** SEARCH - NORMAL VIDEOS */
  searchNormalPacks(searchParams: any) {
    return from(this.searchLocalNormalPacks(searchParams));
  }

  private async searchLocalNormalPacks(params: any) {
    let packs = await this.getAllPacks();
    console.log("📦 [searchLocalNormalPacks] Fetching NORMAL videos, count:", packs.length);

    return this.applySearchFilters(packs, params, "normal");
  }

  /** SEARCH - RETURN VIDEOS */
  searchReturnPacks(searchParams: any) {
    return from(this.searchLocalReturnPacks(searchParams));
  }

  private async searchLocalReturnPacks(params: any) {
    let packs = await this.getAllReturnVideos();
    console.log("🔄 [searchLocalReturnPacks] Fetching RETURN videos, count:", packs.length);

    return this.applySearchFilters(packs, params, "return");
  }

  /** SEARCH - BOTH TYPES (for compatibility) */
  searchPacks(searchParams: any) {
    return from(this.searchLocalPacks(searchParams));
  }

  private async searchLocalPacks(params: any) {
    // Determine which storage to query based on videoType filter
    let packs: PackDoc[] = [];
    const videoTypeFilter = params.filters?.value || [];

    console.log("🚀 ~ PackService ~ searchLocalPacks ~ videoTypeFilter:", videoTypeFilter);

    if (videoTypeFilter.includes("normal")) {
      packs = await this.getAllPacks();
      console.log("📦 [searchLocalPacks] Fetching NORMAL videos, count:", packs.length);
    } else if (videoTypeFilter.includes("return")) {
      packs = await this.getAllReturnVideos();
      console.log("🔄 [searchLocalPacks] Fetching RETURN videos, count:", packs.length);
    } else {
      // If no filter specified, get both and merge
      const normalPacks = await this.getAllPacks();
      const returnPacks = await this.getAllReturnVideos();
      packs = [...normalPacks, ...returnPacks];
      console.log("📋 [searchLocalPacks] Fetching BOTH types, normal:", normalPacks.length, "return:", returnPacks.length);
    }

    console.log("🚀 ~ PackService ~ searchLocalPacks ~ packs:", packs);
    return this.applySearchFilters(packs, params, "");
  }

  /** Apply common search filters, sorting, and pagination */
  private applySearchFilters(packs: PackDoc[], params: any, type: string) {
    console.log(`🚀 ~ PackService ~ applySearchFilters ~ type: ${type}, packs count:`, packs.length);

    // Filter by keyword
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      packs = packs.filter((p) => p.packNumber?.toLowerCase().includes(keyword) || p.orderCode?.toLowerCase().includes(keyword));
    }

    // Filter by date range
    if (params.startDate || params.endDate) {
      console.log("🔍 Filtering by date range:", {
        startDate: params.startDate,
        endDate: params.endDate,
        startDateStr: params.startDate ? new Date(params.startDate).toISOString() : null,
        endDateStr: params.endDate ? new Date(params.endDate).toISOString() : null,
      });

      packs = packs.filter((p) => {
        const packDateStr = p.createdAt || p.startRecordDate;
        if (!packDateStr) {
          console.log(`⏭️  Skip pack (no date): ${p.packNumber || p._id}`);
          return false;
        }

        // Convert pack date to local date string using LOCAL time (not UTC)
        const packDate = new Date(packDateStr);
        const packYear = packDate.getFullYear();
        const packMonth = String(packDate.getMonth() + 1).padStart(2, "0");
        const packDay = String(packDate.getDate()).padStart(2, "0");
        const packDateLocal = `${packYear}-${packMonth}-${packDay}`; // 2026-04-06

        console.log(`📅 Pack date (local): ${packDateLocal}, pack: ${p.packNumber || p._id}`);

        let passesFilter = true;

        if (params.startDate) {
          const startDate = new Date(params.startDate);
          const startYear = startDate.getFullYear();
          const startMonth = String(startDate.getMonth() + 1).padStart(2, "0");
          const startDay = String(startDate.getDate()).padStart(2, "0");
          const startDateLocal = `${startYear}-${startMonth}-${startDay}`; // 2026-04-06

          console.log(`📅 Start filter (local): ${startDateLocal}`);

          if (packDateLocal < startDateLocal) {
            passesFilter = false;
            console.log(`❌ Pack ${p.packNumber} excluded: ${packDateLocal} < ${startDateLocal} (startDate)`);
          }
        }

        if (params.endDate && passesFilter) {
          const endDate = new Date(params.endDate);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
          const endDay = String(endDate.getDate()).padStart(2, "0");
          const endDateLocal = `${endYear}-${endMonth}-${endDay}`; // 2026-04-06

          console.log(`📅 End filter (local): ${endDateLocal}`);

          if (packDateLocal > endDateLocal) {
            passesFilter = false;
            console.log(`❌ Pack ${p.packNumber} excluded: ${packDateLocal} > ${endDateLocal} (endDate)`);
          }
        }

        if (passesFilter) {
          const startLocalStr = params.startDate
            ? (() => {
                const d = new Date(params.startDate);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              })()
            : "any";
          const endLocalStr = params.endDate
            ? (() => {
                const d = new Date(params.endDate);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              })()
            : "any";
          console.log(`✅ Pack ${p.packNumber} included: ${packDateLocal} (range: ${startLocalStr} - ${endLocalStr})`);
        }

        return passesFilter;
      });
      console.log(`📊 After date filter: ${packs.length} packs remain`);
    }

    // Apply sorting
    if (params.sortBy) {
      const { key, value } = params.sortBy;
      packs.sort((a: any, b: any) => {
        let aVal = a[key];
        let bVal = b[key];

        // Handle dates
        if (aVal instanceof Date) aVal = aVal.getTime();
        if (bVal instanceof Date) bVal = bVal.getTime();
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();

        if (aVal < bVal) return value === "ascend" ? -1 : 1;
        if (aVal > bVal) return value === "ascend" ? 1 : -1;
        return 0;
      });
    }

    const totalItem = packs.length;

    // Validate pagination params
    const pageIdx = Math.max(1, params.pageIdx || 1); // minimum = 1
    const pageSize = Math.max(1, params.pageSize || 10); // minimum = 1

    const start = (pageIdx - 1) * pageSize; // 1-indexed: pageIdx=1 → start=0
    const end = start + pageSize;

    const pageData = packs.slice(start, end);

    console.log(`✅ Search result [${type}]:`, { count: pageData.length, totalItem, pageIdx, pageSize });

    return {
      packs: pageData,
      pageIdx,
      totalItem,
      totalPage: Math.ceil(totalItem / pageSize),
    };
  }

  /** Get return videos by orderCode (from separate return videos storage) */
  getReturnVideosByOrderCode(orderCode: string) {
    return from(this.getReturnVideosLocal(orderCode));
  }

  private async getReturnVideosLocal(orderCode: string): Promise<PackDoc[]> {
    const returnVideos = await this.getAllReturnVideos();
    console.log("🚀 ~ PackService ~ getReturnVideosLocal ~ returnVideos:", returnVideos);
    return returnVideos.filter((p) => p.orderCode === orderCode || p.packNumber === orderCode);
  }

  /** Get normal videos by orderCode (from normal packs storage) */
  getNormalVideosByOrderCode(orderCode: string) {
    return from(this.getNormalVideosLocal(orderCode));
  }

  private async getNormalVideosLocal(orderCode: string): Promise<PackDoc[]> {
    const normalPacks = await this.getAllPacks();
    console.log("🚀 ~ PackService ~ getNormalVideosLocal ~ normalPacks:", normalPacks);
    return normalPacks.filter((p) => p.orderCode === orderCode || p.packNumber === orderCode);
  }

  /** Get all return videos for viewing/management */
  getAllReturnVideosList() {
    return from(this.getAllReturnVideos());
  }
}
