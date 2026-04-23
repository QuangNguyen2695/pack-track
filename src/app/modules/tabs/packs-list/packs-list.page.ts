import { Component, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzTableQueryParams, NzTableSortOrder } from "ng-zorro-antd/table";
import { Subject, debounceTime, from, switchMap, take, takeUntil, tap, catchError, of } from "rxjs";
import * as moment from "moment";
import { PackDoc, PackListQuery, PackStatus, SearchPacksResult } from "@rsApp/shared/models/pack.model";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
import { AdmobService } from "@rsApp/shared/services/admob-service/dmob.service";
import { SettingsService } from "@rsApp/shared/services/settings/settings.service";
import { CommonModule } from "@angular/common";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { IonicModule } from "@ionic/angular";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { DeviceInfoService } from "@rsApp/shared/services/device/device-info.service";
import { VideoRecoveryService } from "@rsApp/shared/services/video-recovery/video-recovery.service";
import { Router } from "@angular/router";
import { toast } from "ngx-sonner";
import { AffiliateService } from "@rsApp/shared/services/affiliate-service/affiliate.service";
import { AffiliateItem, AffiliatePack, AffiliateSingleProduct } from "@rsApp/shared/services/affiliate-service/affiliate.model";

type SortOpt = "newest" | "oldest" | "duration_desc" | "duration_asc";

@Component({
  selector: "app-packs-list",
  templateUrl: "./packs-list.page.html",
  styleUrls: ["./packs-list.page.scss"],
  imports: [CommonModule, FormsModule, IonicModule, NZModule, ReactiveFormsModule, ScrollingModule],
})
export class PacksListPage implements OnInit, OnDestroy {
  form!: FormGroup;

  // Separate search results for normal and return videos
  searchPacksNormal: SearchPacksResult<PackDoc> = { packs: [], pageIdx: 1, totalItem: 0, totalPage: 0 };
  searchPacksReturn: SearchPacksResult<PackDoc> = { packs: [], pageIdx: 1, totalItem: 0, totalPage: 0 };
  activeTab: "normal" | "return" = "normal"; // Track active tab

  // Separate search params for normal videos
  searchParamsNormal = {
    pageIdx: 1,
    startDate: "" as Date | "",
    endDate: "" as Date | "",
    pageSize: 10,
    keyword: "",
    sortBy: {
      key: "createdAt",
      value: "descend",
    },
  };

  // Separate search params for return videos
  searchParamsReturn = {
    pageIdx: 1,
    startDate: "" as Date | "",
    endDate: "" as Date | "",
    pageSize: 10,
    keyword: "",
    sortBy: {
      key: "createdAt",
      value: "descend",
    },
  };

  loading = false;
  loadingMore = false;
  recoveryInProgress = false;
  reachedEndNormal = false; // Reached end for normal videos
  reachedEndReturn = false; // Reached end for return videos

  // Selected videos for bulk delete
  selectedVideoIds = new Set<string>(); // Track selected video IDs

  // Separate owner sets for each tab
  ownerIdSetNormal = new Set<string>(); // set các pack _id thuộc thiết bị hiện tại (normal videos)
  ownerIdSetReturn = new Set<string>(); // set các pack _id thuộc thiết bị hiện tại (return videos)
  // filters
  sortOpt: SortOpt = "newest";

  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  currentDeviceId: string | null = null;
  componentElement: HTMLElement | undefined;
  userType: "seller" | "buyer" = "seller"; // Track user type for conditional display

  // Affiliate item display
  affiliateItem: AffiliateItem | null = null;
  affiliateDisplayIndex: number = -1; // Track at which index to show affiliate item

  nativeAds: Record<number, any> = {};

  constructor(
    private fb: FormBuilder,
    private packService: PackService,
    private deviceInfo: DeviceInfoService,
    private router: Router,
    private nativeComponent: ElementRef,
    private ads: AdmobService,
    private videoRecoveryService: VideoRecoveryService,
    private settingsService: SettingsService,
    private affiliateService: AffiliateService,
  ) {
    this.componentElement = this.nativeComponent.nativeElement;
  }

  ngOnInit(): void {
    // Load user type from settings
    this.settingsService.settings$.pipe(takeUntil(this.destroy$)).subscribe((settings) => {
      this.userType = settings.userType;
    });

    // Initialize current device ID
    this.deviceInfo
      .getDeviceInfo()
      .then((info) => {
        this.currentDeviceId = info.deviceId;
      })
      .catch((err) => {});

    this.form = this.fb.group({
      status: [null], // PackStatus | null (cho API)
      date: [null as Date | null], // Đổi từ dateRange thành date
      keyword: [""],
    });

    // Auto-search khi form changes (với debounce)
    this.form.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(600), // Chờ 600ms sau khi user stop typing
        tap(() => this.onSearch()),
      )
      .subscribe();

    // initial load pipeline - load BOTH tabs simultaneously
    this.reload$
      .pipe(
        takeUntil(this.destroy$),
        tap(() => (this.loading = true)),
        switchMap(() => this.fetchBothTabs()),
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.loadRandomAffiliateItem(); // Load affiliate item after data loads
        },
        error: () => (this.loading = false),
      });

    this.reload$.next();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load random affiliate item to display in the list
   */
  private loadRandomAffiliateItem(): void {
    if (this.affiliateService.isReady()) {
      this.affiliateItem = this.affiliateService.getRandomItem();
      if (this.affiliateItem) {
        // Set random display index (0-5) so affiliate appears randomly in the list
        this.affiliateDisplayIndex = Math.floor(Math.random() * 6);
      }
    }
  }

  /**
   * Load affiliate item for newly loaded batch (load more scenario)
   * Display it randomly within the newly loaded items instead of from top
   */
  private loadAffiliateForLoadMore(): void {
    if (this.affiliateService.isReady()) {
      this.affiliateItem = this.affiliateService.getRandomItem();
      if (this.affiliateItem) {
        // Calculate the starting index of newly loaded items
        const pageSize = this.searchParamsNormal.pageSize; // or pageSize from search params
        const totalItemsBeforeNewBatch = this.currentSearchPacks.packs.length - pageSize;

        // Set random display index within the newly loaded batch (0-9 within the new page)
        const randomOffsetInBatch = Math.floor(Math.random() * Math.min(10, pageSize)); // Show within first 10 of new batch
        this.affiliateDisplayIndex = Math.max(0, totalItemsBeforeNewBatch + randomOffsetInBatch);
      }
    }
  }

  /**
   * Check if affiliate item is a pack (contains multiple products)
   */
  isAffiliatePack(item: AffiliateItem | null): item is AffiliatePack {
    return item !== null && item.type === "pack";
  }

  /**
   * Check if affiliate item is a single product
   */
  isAffiliateSingleProduct(item: AffiliateItem | null): item is AffiliateSingleProduct {
    return item !== null && item.type === "product";
  }

  /**
   * Get primary link for affiliate item
   */
  getAffiliateLink(item: AffiliateItem | null): string {
    if (!item) return "";

    // For pack: get link from first product
    if (this.isAffiliatePack(item)) {
      const firstProduct = item.products?.[0];
      if (firstProduct?.links && firstProduct.links.length > 0) {
        return firstProduct.links[0];
      }
    }
    // For single product: get link directly
    else if (this.isAffiliateSingleProduct(item)) {
      if (item.links && item.links.length > 0) {
        return item.links[0];
      }
    }

    return "";
  }

  /**
   * Get title for affiliate item (pack or product name)
   */
  getAffiliateTitle(item: AffiliateItem | null): string {
    if (!item) return "";
    if (this.isAffiliatePack(item)) {
      return item.title;
    } else if (this.isAffiliateSingleProduct(item)) {
      return item.name;
    }
    return "";
  }

  /**
   * Get image for affiliate item
   */
  getAffiliateImage(item: AffiliateItem | null): string {
    if (!item) return "";
    if (this.isAffiliatePack(item)) {
      return item.thumbnail;
    } else if (this.isAffiliateSingleProduct(item)) {
      return item.image;
    }
    return "";
  }

  /**
   * Open affiliate link in new tab
   */
  openAffiliateLink(item: AffiliateItem | null): void {
    const link = this.getAffiliateLink(item);
    if (link) {
      window.open(link, "_blank");
    }
  }

  /**
   * Check if affiliate item should be displayed at this index
   */
  shouldShowAffiliateAtIndex(index: number): boolean {
    return this.affiliateDisplayIndex === index;
  }

  // Refresh every time the tab becomes active
  async ionViewWillEnter() {
    // Use existing reload pipeline so loading state is handled consistently
    this.reload$.next();
  }

  // Kiểm tra và hiển thị quảng cáo khi rời khỏi page
  async ionViewWillLeave() {
    // Also try to show reward ad
    await this.ads.checkAndShowRewardAd();
  }

  // Pull-to-Refresh handler
  async onRefresh(event: any) {
    try {
      this.searchParamsNormal.pageIdx = 1;
      this.searchParamsReturn.pageIdx = 1;
      this.reachedEndNormal = false;
      this.reachedEndReturn = false;
      this.searchParamsNormal.pageSize = 10;
      this.searchParamsReturn.pageSize = 10;
      this.searchPacksNormal.totalItem = 0; // Reset total items
      this.searchPacksReturn.totalItem = 0; // Reset total items

      // Wait for reload to complete
      await this.fetchBothTabs().toPromise();
    } catch (error) {
    } finally {
      // Complete the refresh animation
      event.detail.complete();
    }
  }

  rebuildOwnerSet() {
    if (!this.currentDeviceId) return;

    // Rebuild for normal videos
    const normalOwnedPacks = (this.searchPacksNormal.packs ?? []).filter((pack) => {
      const packWithCache = pack as PackDoc & { _isCached?: boolean };
      if (packWithCache._isCached) return true;
      return (pack.deviceId ?? "").trim() === this.currentDeviceId;
    });
    this.ownerIdSetNormal = new Set(normalOwnedPacks.map((x) => x._id));

    // Rebuild for return videos
    const returnOwnedPacks = (this.searchPacksReturn.packs ?? []).filter((pack) => {
      const packWithCache = pack as PackDoc & { _isCached?: boolean };
      if (packWithCache._isCached) return true;
      return (pack.deviceId ?? "").trim() === this.currentDeviceId;
    });
    this.ownerIdSetReturn = new Set(returnOwnedPacks.map((x) => x._id));
  }

  // ---------- Actions ----------
  onTabChange(tab: "normal" | "return"): void {
    this.activeTab = tab;
    this.clearSelection(); // Clear selection when switching tabs
    // Don't reload on tab change - data is already loaded from init
    // Keep the existing reachedEnd flags as they should already be correctly set during fetchBothTabs()
  }

  onSearch(): void {
    this.searchParamsNormal.pageIdx = 1;
    this.searchParamsReturn.pageIdx = 1;
    this.reachedEndNormal = false;
    this.reachedEndReturn = false;
    this.reload$.next();
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

  onDateChange(date: any) {
    if (date) {
      // Log local date components
      if (date instanceof Date || date.toDate) {
        const d = date instanceof Date ? date : date.toDate();
      }
    }
    // Update form with the selected date
    this.form.patchValue({ date }, { emitEvent: false });
    // Trigger search after date selection
    this.onSearch();
  }

  async forceRecoverySync() {
    this.recoveryInProgress = true;

    try {
      const recoveredCount = await this.videoRecoveryService.manualRecovery();
      // Refresh the list to show newly recovered videos
      this.onSearch();
    } catch (error) {
    } finally {
      this.recoveryInProgress = false;
    }
  }

  // Toggle video selection
  toggleVideoSelection(videoId: string, event?: any): void {
    if (event) {
      event.stopPropagation(); // Prevent card click when clicking checkbox
    }
    if (this.selectedVideoIds.has(videoId)) {
      this.selectedVideoIds.delete(videoId);
    } else {
      this.selectedVideoIds.add(videoId);
    }
  }

  // Check if video is selected
  isVideoSelected(videoId: string): boolean {
    return this.selectedVideoIds.has(videoId);
  }

  // Get count of selected videos
  getSelectedCount(): number {
    return this.selectedVideoIds.size;
  }

  // Delete selected videos
  async deleteSelected(): Promise<void> {
    if (this.selectedVideoIds.size === 0) return;

    const confirmed = window.confirm(`Bạn chắc chắn muốn xóa ${this.selectedVideoIds.size} video không?`);
    if (!confirmed) return;

    try {
      const videoIdsToDelete = Array.from(this.selectedVideoIds);

      // Call appropriate service method based on active tab
      if (this.activeTab === "normal") {
        await this.packService.removeNormalPacks(videoIdsToDelete).toPromise();
      } else {
        await this.packService.removeReturnVideos(videoIdsToDelete).toPromise();
      }

      // Clear selection
      this.selectedVideoIds.clear();

      // Refresh the list
      this.onSearch();
      toast.success(`Đã xóa ${videoIdsToDelete.length} video`);
    } catch (error) {
      toast.error("Xóa video thất bại");
    }
  }

  // Select all videos in current tab
  selectAll(): void {
    const currentVideos = this.currentSearchPacks.packs ?? [];
    for (const video of currentVideos) {
      this.selectedVideoIds.add(video._id);
    }
  }

  // Clear all selections
  clearSelection(): void {
    this.selectedVideoIds.clear();
  }

  loadMore() {
    if (this.isCurrentTabReachedEnd || this.loadingMore) return;
    this.loadingMore = true;

    // Get current page from active tab and increment
    if (this.activeTab === "normal") {
      this.searchParamsNormal.pageIdx += 1;
    } else {
      this.searchParamsReturn.pageIdx += 1;
    }

    this.fetchPage(true).subscribe({
      next: () => {
        this.loadingMore = false;
        // Load affiliate item for the newly loaded items
        this.loadAffiliateForLoadMore();
      },
      error: () => {
        this.loadingMore = false;
      },
    });
  }

  // ---------- Data ----------
  private fetchBothTabs() {
    this.setParamsSearch();

    // Fetch both normal and return videos simultaneously
    return this.packService.searchNormalPacks(this.searchParamsNormal).pipe(
      switchMap(async (normalResult) => {
        const sortedPacks = this.applySortToPacks(normalResult.packs);
        this.searchPacksNormal = { ...normalResult, packs: sortedPacks };
        // Check if reached end: total items >= totalItem, OR returned items < pageSize
        const itemsReturnedLessThanPageSize = (normalResult.packs?.length ?? 0) < this.searchParamsNormal.pageSize;
        this.reachedEndNormal = this.searchPacksNormal.packs.length >= normalResult.totalItem || itemsReturnedLessThanPageSize;
        // Now fetch return videos
        return this.packService.searchReturnPacks(this.searchParamsReturn).toPromise();
      }),
      switchMap(async (returnResult) => {
        if (returnResult) {
          const sortedPacks = this.applySortToPacks(returnResult.packs);
          this.searchPacksReturn = { ...returnResult, packs: sortedPacks };
          // Check if reached end: total items >= totalItem, OR returned items < pageSize
          const itemsReturnedLessThanPageSize = (returnResult.packs?.length ?? 0) < this.searchParamsReturn.pageSize;
          this.reachedEndReturn = this.searchPacksReturn.packs.length >= returnResult.totalItem || itemsReturnedLessThanPageSize;
        }
        this.rebuildOwnerSet();
        return Promise.resolve();
      }),
      catchError(async (error) => {
        return Promise.resolve();
      }),
    );
  }

  private fetchPage(append: boolean) {
    if (this.activeTab === "normal") {
      return this.searchPacksNormalPage(append);
    } else {
      return this.searchPacksReturnPage(append);
    }
  }

  private searchPacksNormalPage(append: boolean) {
    return this.packService.searchNormalPacks(this.searchParamsNormal).pipe(
      switchMap(async (apiResult) => {
        return this.processSearchResult(apiResult, append);
      }),
      catchError(async (error) => {
        return {
          packs: [],
          pageIdx: this.searchParamsNormal.pageIdx,
          totalItem: 0,
          totalPage: 0,
        } as SearchPacksResult<PackDoc>;
      }),
      tap((res) => {
        if (res) {
          if (append) {
            // Filter out duplicates based on _id before appending
            const existingIds = new Set(this.searchPacksNormal.packs.map((p) => p._id));
            const newPacks = res.packs.filter((p) => !existingIds.has(p._id));
            this.searchPacksNormal.packs = [...this.searchPacksNormal.packs, ...newPacks];
            this.searchPacksNormal.pageIdx = res.pageIdx;
            this.searchPacksNormal.totalItem = res.totalItem; // Update totalItem during append
          } else {
            this.searchPacksNormal = { ...res };
          }
          this.rebuildOwnerSet();
        }
        // Check if reached end: total items now >= totalItem, OR returned items < pageSize
        const itemsReturnedLessThanPageSize = (res.packs?.length ?? 0) < this.searchParamsNormal.pageSize;
        const totalItemsNow = this.searchPacksNormal.packs?.length ?? 0;
        this.reachedEndNormal = totalItemsNow >= res.totalItem || itemsReturnedLessThanPageSize;
      }),
    );
  }

  private searchPacksReturnPage(append: boolean) {
    return this.packService.searchReturnPacks(this.searchParamsReturn).pipe(
      switchMap(async (apiResult) => {
        return this.processSearchResult(apiResult, append);
      }),
      catchError(async (error) => {
        return {
          packs: [],
          pageIdx: this.searchParamsReturn.pageIdx,
          totalItem: 0,
          totalPage: 0,
        } as SearchPacksResult<PackDoc>;
      }),
      tap((res) => {
        if (res) {
          if (append) {
            // Filter out duplicates based on _id before appending
            const existingIds = new Set(this.searchPacksReturn.packs.map((p) => p._id));
            const newPacks = res.packs.filter((p) => !existingIds.has(p._id));
            this.searchPacksReturn.packs = [...this.searchPacksReturn.packs, ...newPacks];
            this.searchPacksReturn.pageIdx = res.pageIdx;
            this.searchPacksReturn.totalItem = res.totalItem; // Update totalItem during append
          } else {
            this.searchPacksReturn = { ...res };
          }
          this.rebuildOwnerSet();
        }
        // Check if reached end: total items now >= totalItem, OR returned items < pageSize
        const itemsReturnedLessThanPageSize = (res.packs?.length ?? 0) < this.searchParamsReturn.pageSize;
        const totalItemsNow = this.searchPacksReturn.packs?.length ?? 0;
        this.reachedEndReturn = totalItemsNow >= res.totalItem || itemsReturnedLessThanPageSize;
      }),
    );
  }

  async processSearchResult(apiResult: SearchPacksResult<PackDoc>, append: boolean) {
    // Apply sort cho merged data
    const sortedPacks = this.applySortToPacks(apiResult.packs);
    return {
      ...apiResult,
      packs: sortedPacks,
      totalItem: apiResult.totalItem,
    };
  }

  private setParamsSearch() {
    const f = this.form.value;

    this.searchParamsNormal.pageIdx = 1;
    this.searchParamsNormal.keyword = f.keyword?.trim() || "";
    this.searchParamsReturn.pageIdx = 1;
    this.searchParamsReturn.keyword = f.keyword?.trim() || "";

    // Convert Dayjs date to ISO string for API (timezone aware)
    if (f.date) {
      try {
        if (f.date && typeof f.date === "object") {
          let year = 0,
            month = 0,
            day = 0;
          let dateStr = "";

          // Handle Dayjs object
          if (f.date.format && typeof f.date.format === "function") {
            // For Dayjs, get the local date components directly
            year = f.date.year();
            month = f.date.month() + 1; // Dayjs month is 0-based
            day = f.date.date();
            dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }
          // Handle native Date object
          else if (f.date instanceof Date) {
            // For Date, get local date components
            year = f.date.getFullYear();
            month = f.date.getMonth() + 1;
            day = f.date.getDate();
            dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

            // Extra debug: show what today's local date is
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          }

          if (year > 0 && month > 0 && day > 0) {
            // Create dates using LOCAL time (Constructor with 3+ args uses local time)
            const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

            (this.searchParamsNormal.startDate as any) = startOfDay;
            (this.searchParamsNormal.endDate as any) = endOfDay;
            (this.searchParamsReturn.startDate as any) = startOfDay;
            (this.searchParamsReturn.endDate as any) = endOfDay;
          }
        }
      } catch (error) {
        this.searchParamsNormal.startDate = "";
        this.searchParamsNormal.endDate = "";
        this.searchParamsReturn.startDate = "";
        this.searchParamsReturn.endDate = "";
      }
    } else {
      this.searchParamsNormal.startDate = "";
      this.searchParamsNormal.endDate = "";
      this.searchParamsReturn.startDate = "";
      this.searchParamsReturn.endDate = "";
    }

    this.searchParamsNormal.pageSize = 10;
    this.searchParamsNormal.sortBy = this.getSortParam(this.sortOpt);
    this.searchParamsReturn.pageSize = 10;
    this.searchParamsReturn.sortBy = this.getSortParam(this.sortOpt);
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
  onThumbnailLoad(packId: string): void {}

  onThumbnailError(packId: string, event: any): void {
    event.target.style.display = "none";
  }

  /**
   * Get count of normal videos from normal tab
   */
  getNormalVideoCount(): number {
    const normalPacks = (this.searchPacksNormal.packs ?? []).filter((pack) => {
      const packWithCache = pack as PackDoc & { _isCached?: boolean };
      const isLocal = packWithCache._isCached || (pack.deviceId ?? "").trim() === this.currentDeviceId;
      return isLocal;
    });
    return normalPacks.length;
  }

  /**
   * Get count of return videos from return tab
   */
  getReturnVideoCount(): number {
    const returnPacks = (this.searchPacksReturn.packs ?? []).filter((pack) => {
      const packWithCache = pack as PackDoc & { _isCached?: boolean };
      const isLocal = packWithCache._isCached || (pack.deviceId ?? "").trim() === this.currentDeviceId;
      return isLocal;
    });
    return returnPacks.length;
  }

  /**
   * Get current tab's search packs
   */
  get currentSearchPacks(): SearchPacksResult<PackDoc> {
    return this.activeTab === "normal" ? this.searchPacksNormal : this.searchPacksReturn;
  }

  /**
   * Get current tab's owner set
   */
  get currentOwnerIdSet(): Set<string> {
    return this.activeTab === "normal" ? this.ownerIdSetNormal : this.ownerIdSetReturn;
  }

  get isCurrentTabReachedEnd(): boolean {
    return this.activeTab === "normal" ? this.reachedEndNormal : this.reachedEndReturn;
  }

  getThumbnailUrl(thumbnailBase64?: string, thumbnailUrl?: string): string {
    if (!thumbnailBase64 && !thumbnailUrl) return "";

    // Ưu tiên URL nếu có
    if (thumbnailUrl && thumbnailUrl.startsWith("http")) {
      return thumbnailUrl;
    }

    // Nếu là base64
    if (thumbnailBase64) {
      try {
        // Xử lý prefix nếu có
        let b64 = thumbnailBase64.trim();

        // Nếu đã có prefix, trả về ngay
        if (b64.startsWith("data:image")) {
          return b64;
        }

        // Nếu chưa có prefix, thêm vào
        if (!b64.includes("base64,")) {
          b64 = `data:image/jpeg;base64,${b64}`;
          return b64;
        }

        return b64;
      } catch (e) {
        return "";
      }
    }

    return "";
  }

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

  openPackDetail(pack: PackDoc) {
    this.router.navigate(["/pack-detail"], { state: { pack } });
  }
}
