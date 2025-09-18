import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzTableQueryParams, NzTableSortOrder } from "ng-zorro-antd/table";
import { Subject, debounceTime, from, switchMap, take, takeUntil, tap } from "rxjs";
import * as moment from "moment";
import { PackDoc, PackListQuery, PackStatus, SearchPacksResult } from "@rsApp/shared/models/pack.model";
import { PackService } from "@rsApp/shared/services/pack-service/pack.service";
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

  constructor(private fb: FormBuilder, private packService: PackService, private deviceInfo: DeviceInfoService, private router: Router) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      status: [null], // PackStatus | null (cho API)
      dateRange: [null as [Date, Date] | null],
      keyword: [""],
    });

    from(this.deviceInfo.getDeviceInfo())
      .pipe(take(1))
      .subscribe((dev) => {
        this.currentDeviceId = (dev?.deviceId ?? "").trim();
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

  rebuildOwnerSet() {
    console.log("🚀 ~ PacksListPage ~ rebuildOwnerSet ~ this.currentDeviceId:", this.currentDeviceId);
    if (!this.currentDeviceId) return;
    this.ownerIdSet = new Set((this.searchPacks.packs ?? []).filter((x) => (x.deviceId ?? "").trim() === this.currentDeviceId).map((x) => x._id));
    console.log("🚀 ~ PacksListPage ~ rebuildOwnerSet ~ this.ownerIdSet:", this.ownerIdSet);
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
    this.form.reset({ status: null, dateRange: null, keyword: "" });
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
      tap((res) => {
        this.reachedEnd = this.searchParams.pageIdx >= res.totalPage;
        if (res) {
          if (append) {
            this.searchPacks.packs = [...this.searchPacks.packs, ...res.packs];
          } else {
            this.searchPacks = res;
          }
          this.rebuildOwnerSet();
        }
      }),
    );
  }

  private setParamsSearch() {
    const f = this.form.value;

    this.searchParams.pageIdx = 1;
    this.searchParams.keyword = f.keyword || "";
    this.searchParams.startDate = f.dateRange?.[0] || "";
    this.searchParams.endDate = f.dateRange?.[1] || "";
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

  openPackDetail(pack: PackDoc) {
    if (!this.ownerIdSet.has(pack._id)) {
      toast.error("Pack này nằm trên một thiết bị khác", { duration: 4000 });
      return;
    }
    this.router.navigate(["/pack-detail"], { state: { pack } });
  }
}
