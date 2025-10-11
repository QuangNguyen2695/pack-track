import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzTableQueryParams, NzTableSortOrder } from "ng-zorro-antd/table";
import { Subject, debounceTime, from, switchMap, take, takeUntil, tap, catchError, of } from "rxjs";
import * as moment from "moment";
import { PackDoc, PackListQuery, PackStatus, SearchPacksResult } from "@rsApp/shared/models/pack.model";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { VideoCacheService } from "@rsApp/shared/services/video-cache/video-cache.service";
import { CommonModule } from "@angular/common";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { IonicModule } from "@ionic/angular";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { Router } from "@angular/router";
import { toast } from "ngx-sonner";

type SortOpt = "newest" | "oldest" | "duration_desc" | "duration_asc";
type StatusValueStr = "Tất cả" | "Verified" | "Failed";

@Component({
  selector: "app-packs-list",
  templateUrl: "./packs-list.page.html",
  styleUrls: ["./packs-list.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule, NZModule, ReactiveFormsModule, ScrollingModule],
})
export class PacksListPage implements OnInit, OnDestroy {
  form!: FormGroup;

  searchPacks: SearchPacksResult<PackDoc> = { packs: [], pageIdx: 1, totalItem: 0, totalPage: 0 };

  searchParams = {
    pageIdx: 1,
    startDate: "" as Date | "",
    endDate: "" as Date | "",
    pageSize: 5,
    keyword: "",
    sortBy: {
      key: "createdAt",
      value: "descend",
    },
    filters: {
      key: "",
      value: [],
    },
  };

  loading = false;
  loadingMore = false;
  reachedEnd = false;

  currentStatusStr: StatusValueStr = "Tất cả"; // for UI tabs
  ownerIdSet = new Set<string>(); // set các pack _id thuộc thiết bị hiện tại
  // filters
  statusTabs: string[] = ["Tất cả", "Verified", "Failed"];
  sortOpt: SortOpt = "newest";

  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  currentDeviceId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private packService: PackService,
    private videoCacheService: VideoCacheService,
    private deviceInfo: DeviceInfoService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      status: [null], // PackStatus | null (cho API)
      date: [null as Date | null], // Đổi từ dateRange thành date
      keyword: [""],
    });

    from(this.deviceInfo.getDeviceInfo())
      .pipe(take(1))
      .subscribe((dev) => {
        this.currentDeviceId = (dev?.deviceId ?? "").trim();
        console.log("🚀 ~ PacksListPage ~ ngOnInit ~ this.currentDeviceId:", this.currentDeviceId)
        // nếu đã có data items, có thể build ownerIdSet ở đây
      });

    // debounce search/date/keyword change
    this.form.valueChanges.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.onSearch());

    // initial load pipeline
    this.reload$
      .pipe(
        takeUntil(this.destroy$),
        tap(() => (this.loading = true)),
        switchMap(() => this.fetchPage(false)),
      )
      .subscribe({
        next: () => (this.loading = false),
        error: () => (this.loading = false),
      });

    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Refresh every time the tab becomes active
  ionViewWillEnter() {
    // Use existing reload pipeline so loading state is handled consistently
    this.reload$.next();
  }

  rebuildOwnerSet() {
    if (!this.currentDeviceId) return;

    const ownedPacks = (this.searchPacks.packs ?? []).filter((pack) => {
      const packWithCache = pack as PackDoc & { _isCached?: boolean };

      // Cached packs luôn thuộc về device hiện tại
      if (packWithCache._isCached) return true;

      // API packs kiểm tra theo deviceId
      return (pack.deviceId ?? "").trim() === this.currentDeviceId;
    });

    this.ownerIdSet = new Set(ownedPacks.map((x) => x._id));
  }

  // ---------- Actions ----------
  onSearch(): void {
    this.searchParams.pageIdx = 1;
    this.reachedEnd = false;
    this.reload$.next();
  }

  onChangeStatus(segVal: StatusValueStr) {
    this.currentStatusStr = segVal;
    // map '' -> null để form gửi đúng kiểu cho API
    const statusForApi = segVal === "Tất cả" ? null : (segVal as any);
    this.form.patchValue({ status: statusForApi }, { emitEvent: true });
  }

  onChangeSort(opt: SortOpt) {
    this.sortOpt = opt;
    this.onSearch();
  }

  onClearFilters() {
    this.form.reset({ status: null, date: null, keyword: "" });
    this.sortOpt = "newest";
    this.onSearch();
  }

  loadMore() {
    if (this.reachedEnd || this.loadingMore) return;
    this.loadingMore = true;
    this.searchParams.pageIdx += 1;
    this.fetchPage(true).subscribe({
      next: () => {
        this.loadingMore = false;
      },
      error: () => {
        this.loadingMore = false;
      },
    });
  }

  // ---------- Data ----------
  private fetchPage(append: boolean) {
    this.setParamsSearch();

    return this.packService.searchPacks(this.searchParams).pipe(
      switchMap(async (apiResult) => {
        return this.processSearchResult(apiResult, append);
      }),
      catchError(async (error) => {
        console.error("🚨 API Error in fetchPage:", error);
        
        // Nếu API fail, chỉ trả về cached data (cho page đầu tiên)
        if (this.searchParams.pageIdx === 1) {
          const cachedPacks = await this.getCachedVideosAsPackDocs();
          console.log("🔄 Fallback to cached data:", cachedPacks);
          
          return {
            packs: cachedPacks,
            pageIdx: 1,
            totalItem: cachedPacks.length,
            totalPage: 1
          } as SearchPacksResult<PackDoc>;
        }
        
        // Cho page tiếp theo, trả về empty result
        return {
          packs: [],
          pageIdx: this.searchParams.pageIdx,
          totalItem: 0,
          totalPage: 0
        } as SearchPacksResult<PackDoc>;
      }),
      tap((res) => {
        console.log("🚀 ~ PacksListPage ~ fetchPage ~ res:", res)
        this.reachedEnd = this.searchParams.pageIdx >= res.totalPage;
        if (res) {
          if (append) {
            this.searchPacks.packs = [...this.searchPacks.packs, ...res.packs];
            console.log("🚀 ~ PacksListPage ~ fetchPage ~ this.searchPacks.packs:", this.searchPacks.packs)
          } else {
            this.searchPacks = res;
          }
          this.rebuildOwnerSet();
        }
      }),
    );
  }

  async processSearchResult(apiResult: SearchPacksResult<PackDoc>, append: boolean) {
    // Lấy cached videos chỉ cho page đầu tiên
    let cachedPacks: PackDoc[] = [];
    if (this.searchParams.pageIdx === 1) {
      cachedPacks = await this.getCachedVideosAsPackDocs();
      console.log("🚀 ~ PacksListPage ~ processSearchResult ~ cachedPacks:", cachedPacks)
    }

    // Merge API data với cached data
    const mergedPacks = this.mergePacks(apiResult.packs, cachedPacks);

    // Apply sort cho merged data
    const sortedPacks = this.applySortToPacks(mergedPacks);

    return {
      ...apiResult,
      packs: sortedPacks,
      totalItem: apiResult.totalItem + cachedPacks.length,
    };
  }

  private setParamsSearch() {
    const f = this.form.value;

    this.searchParams.pageIdx = 1;
    this.searchParams.keyword = f.keyword || "";
    // Sử dụng single date thay vì date range
    this.searchParams.startDate = f.date || "";
    this.searchParams.endDate = f.date || ""; // Cùng ngày cho start và end
    this.searchParams.pageSize = 10;
    this.searchParams.sortBy = this.getSortParam(this.sortOpt);
  }

  private getSortParam(opt: SortOpt): { key: string; value: string } {
    switch (opt) {
      case "newest":
        return { key: "createdAt", value: "descend" };
      case "oldest":
        return { key: "createdAt", value: "ascend" };
      case "duration_desc":
        return { key: "timeRecordedMs", value: "descend" };
      case "duration_asc":
        return { key: "timeRecordedMs", value: "ascend" };
      default:
        return { key: "createdAt", value: "descend" };
    }
  }

  // ---------- UI helpers ----------
  fmtDuration(ms: number): string {
    const totalSec = Math.floor((ms || 0) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (v: number) => (v < 10 ? "0" + v : String(v));
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /**
   * Convert cached video thành PackDoc format để hiển thị trong list
   */
  private convertCachedVideoToPackDoc(cachedVideo: any): PackDoc {
    const payload = cachedVideo.payload;

    return {
      _id: `cache_${cachedVideo.id}`, // prefix để phân biệt với pack từ server
      userId: payload.userId || "",
      deviceId: payload.deviceId || "",
      packNumber: payload.packNumber || "",
      orderCode: payload.orderCode || "",
      createDate: new Date(cachedVideo.timestamp).toISOString(),
      startRecordDate: payload.startRecordDate || "",
      endRecordDate: payload.endRecordDate || "",
      timeRecordedMs: payload.timeRecordedMs || 0,
      status: "pending" as any, // Status đặc biệt cho cached items
      videoStorage: "local" as any,
      videoStorageKey: payload.videoStorageKey || "",
      videoFileName: payload.videoFileName || "",
      videoFileSize: payload.videoFileSize || 0,
      videoMimeType: payload.videoMimeType || "video/mp4",
      appVersion: payload.appVersion || "",
      notes: payload.notes || "",
      createdAt: new Date(cachedVideo.timestamp).toISOString(),
      updatedAt: new Date(cachedVideo.timestamp).toISOString(),
      // Thêm flag để phân biệt
      _isCached: true,
    } as PackDoc & { _isCached: boolean };
  }

  /**
   * Merge API packs với cached packs, tránh duplicate
   */
  private mergePacks(apiPacks: PackDoc[], cachedPacks: PackDoc[]): PackDoc[] {
    // Filter cached packs để tránh duplicate với API data
    // So sánh bằng orderCode và deviceId
    const filteredCachedPacks = cachedPacks.filter((cachedPack) => {
      return !apiPacks.some((apiPack) => apiPack.orderCode === cachedPack.orderCode && apiPack.deviceId === cachedPack.deviceId);
    });

    // Merge: cached packs đầu tiên (để hiển thị ở top), sau đó API packs
    return [...filteredCachedPacks, ...apiPacks];
  }

  /**
   * Apply sort logic cho merged packs
   */
  private applySortToPacks(packs: PackDoc[]): PackDoc[] {
    const sorted = [...packs];

    switch (this.sortOpt) {
      case "newest":
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "duration_desc":
        return sorted.sort((a, b) => (b.timeRecordedMs || 0) - (a.timeRecordedMs || 0));
      case "duration_asc":
        return sorted.sort((a, b) => (a.timeRecordedMs || 0) - (b.timeRecordedMs || 0));
      default:
        return sorted;
    }
  }

  /**
   * Lấy cached videos và merge với API results
   */
  private async getCachedVideosAsPackDocs(): Promise<PackDoc[]> {
    try {
      const cachedVideos = await this.videoCacheService.getCachedVideos();

      // Filter theo device hiện tại nếu cần
      const filteredCached = cachedVideos.filter((video) => {
        if (!this.currentDeviceId) return true;
        return video.payload?.deviceId === this.currentDeviceId;
      });

      return filteredCached.map((video) => this.convertCachedVideoToPackDoc(video));
    } catch (error) {
      console.error("Failed to get cached videos:", error);
      return [];
    }
  }

  openPackDetail(pack: PackDoc) {
    const packWithCache = pack as PackDoc & { _isCached?: boolean };

    // Nếu là cached pack, hiển thị thông báo đặc biệt
    // if (packWithCache._isCached) {
    //   toast.warning("Video này đang chờ đồng bộ lên server", { duration: 3000 });
    //   return;
    // }

    if (!this.ownerIdSet.has(pack._id)) {
      toast.error("Pack này nằm trên một thiết bị khác", { duration: 4000 });
      return;
    }

    this.router.navigate(["/pack-detail"], { state: { pack } });
  }
}
