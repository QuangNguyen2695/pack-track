import { Injectable } from "@angular/core";
import { of, from } from "rxjs";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { HttpParams } from "@angular/common/http";

import { ApiGatewayService } from "src/app/api-gateway/api-gateaway.service";
import { DeviceRegisterPayload, DeviceDoc, DeviceUpdatePushPayload, DeviceListQuery, ListResult } from "@rsApp/shared/models/device.model";

// Nếu bạn đã có CredentialService để lưu tạm deviceId hiện tại thì inject vào.
// Ở đây để tối giản, mình lưu trong sessionStorage/localStorage.
const DEVICE_ID_STORAGE_KEY = "current_device_doc_id";

@Injectable({ providedIn: "root" })
export class DeviceAccessService {
  private readonly baseUrl = `/devices`;

  constructor(private apiGateway: ApiGatewayService) {}

  // ========================================================================
  // Register / Upsert device
  // ========================================================================
  register(payload: DeviceRegisterPayload) {
    const url = `${this.baseUrl}`;
    return this.apiGateway.post(url, payload).pipe(
      tap((res: any) => {
        const id = res?.data?._id;
        if (id) sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      }),
      map((res: any) => res?.data as DeviceDoc),
      catchError((error) => {
        // write log
        return of(error?.error ?? null);
      }),
    );
  }

  // ========================================================================
  // Update push token for current device (uses stored _id)
  // ========================================================================
  updatePushToken(userId: string, data: DeviceUpdatePushPayload) {
    const id = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      // không có id hiện tại => fail nhẹ
      return of(null);
    }
    const url = `${this.baseUrl}/${id}/push-token`;

    return this.apiGateway.put(url, data).pipe(
      map((res: any) => res?.data as DeviceDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  // ========================================================================
  // Mark current device as primary
  // ========================================================================
  markPrimary(userId: string) {
    const id = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) return of(null);

    const url = `${this.baseUrl}/${id}/primary`;

    return this.apiGateway.put(url, {}).pipe(
      map((res: any) => res?.data as DeviceDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  // ========================================================================
  // Get by id (dùng cho trang chi tiết)
  // ========================================================================
  getById(id: string, userId: string) {
    const url = `${this.baseUrl}/${id}`;

    return this.apiGateway.get(url).pipe(
      map((res: any) => res?.data as DeviceDoc),
      catchError((error) => of(error?.error ?? null)),
    );
  }

  // ========================================================================
  // List devices (admin/profile)
  // ========================================================================
  list(query: DeviceListQuery) {
    let params = new HttpParams();
    if (query.userId) params = params.set("userId", query.userId);
    if (query.platform) params = params.set("platform", query.platform);
    if (query.active !== undefined) params = params.set("active", String(query.active));
    if (query.search) params = params.set("search", query.search);
    if (query.page) params = params.set("page", String(query.page));
    if (query.limit) params = params.set("limit", String(query.limit));

    const url = `${this.baseUrl}`;
    return this.apiGateway.get(url).pipe(
      map((res: any) => res as ListResult<DeviceDoc>),
      catchError((error) => of(error?.error ?? { items: [], total: 0, page: 1, limit: 20 })),
    );
  }

  // ========================================================================
  // Remove device (soft delete)
  // ========================================================================
  remove(id: string, userId: string) {
    const url = `${this.baseUrl}/${id}`;

    return this.apiGateway.delete(url).pipe(
      map((res: any) => res), // { success: true }
      catchError((error) => of(error?.error ?? null)),
    );
  }

  // ========================================================================
  // Helper: lưu/đọc _id thiết bị hiện tại (tuỳ bạn có thể chuyển sang CredentialService)
  // ========================================================================
  getCurrentDeviceId() {
    return sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
  }

  setCurrentDeviceId(id: string) {
    sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  }

  clearCurrentDeviceId() {
    sessionStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  }
}
