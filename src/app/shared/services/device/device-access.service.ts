import { Injectable } from "@angular/core";
import { of, from } from "rxjs";
import { catchError, map, switchMap, tap } from "rxjs/operators";
import { HttpParams } from "@angular/common/http";

import { DeviceRegisterPayload, DeviceDoc, DeviceUpdatePushPayload, DeviceListQuery, ListResult } from "@rsApp/shared/models/device.model";

// Nếu bạn đã có CredentialService để lưu tạm deviceId hiện tại thì inject vào.
// Ở đây để tối giản, mình lưu trong sessionStorage/localStorage.
const DEVICE_ID_STORAGE_KEY = "current_device_doc_id";

@Injectable({ providedIn: "root" })
export class DeviceAccessService {
  private readonly baseUrl = `/devices`;

  constructor() {}

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
