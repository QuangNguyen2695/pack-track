import { Injectable } from "@angular/core";
import { of } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { HttpParams } from "@angular/common/http";
import { ApiGatewayService } from "src/app/api-gateway/api-gateaway.service";
import { PackCreatePayload, PackDoc, PackListQuery } from "@rsApp/shared/models/pack.model";
import { ListResult } from "@rsApp/shared/models/device.model";

@Injectable({ providedIn: "root" })
export class PackService {
  private readonly baseUrl = "/pack-recordings";

  constructor(private api: ApiGatewayService) {}

  /** Tạo record sau khi quay xong */
  create(payload: PackCreatePayload) {
    const url = `${this.baseUrl}`;
    return this.api.post(url, payload).pipe(
      map((res: any) => res?.data as PackDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  /** Cập nhật một phần (status, video info…) */
  update(id: string, patch: Partial<PackCreatePayload>) {
    const url = `${this.baseUrl}/${id}`;

    return this.api.put(url, patch).pipe(
      map((res: any) => res?.data as PackDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  /** Đánh dấu uploaded (sau khi upload file xong) */
  markUploaded(id: string, body: { videoStorageKey?: string; videoFileSize?: number; videoChecksum?: string }) {
    const url = `${this.baseUrl}/${id}/mark-uploaded`;

    return this.api.put(url, body).pipe(
      map((res: any) => res?.data as PackDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  /** Đánh dấu verified (sau QC) */
  markVerified(id: string) {
    const url = `${this.baseUrl}/${id}/mark-verified`;

    return this.api.put(url, {}).pipe(
      map((res: any) => res?.data as PackDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  /** Lấy chi tiết */
  getById(id: string) {
    const url = `${this.baseUrl}/${id}`;

    return this.api.get(url).pipe(
      map((res: any) => res?.data as PackDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  /** Soft-delete nếu cần */
  remove(id: string) {
    const url = `${this.baseUrl}/${id}`;

    return this.api.delete(url).pipe(
      map((res: any) => res), // { success: true }
      catchError((error) => of(error?.error ?? null)),
    );
  }

  searchPacks(searchParams: {
    pageIdx: number;
    startDate: Date | "";
    endDate: Date | "";
    pageSize: number;
    keyword: string;
    sortBy: {
      key: string;
      value: string;
    };
    filters: {
      key: string;
      value: string[];
    };
  }) {
    const url = `${this.baseUrl}/search`;
    const body = {
      pageIdx: searchParams.pageIdx,
      startDate: searchParams.startDate,
      endDate: searchParams.endDate,
      pageSize: searchParams.pageSize,
      keyword: searchParams.keyword,
      sortBy: searchParams.sortBy,
      filters: searchParams.filters,
    };

    return this.api.post(url, body, true).pipe(tap((res: any) => {}));
  }
}
