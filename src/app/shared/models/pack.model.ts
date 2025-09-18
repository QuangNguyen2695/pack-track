import { D } from "@angular/cdk/bidi-module.d-IN1Vp56w";
import { DeviceDoc } from "@rsApp/shared/models/device.model";

export type PackStatus = "recorded" | "uploading" | "uploaded" | "verified" | "failed";
export type StorageProvider = "local" | "s3" | "gcs" | "azure";

export interface PackCreatePayload {
  userId: string;

  deviceId: string; // từ DeviceInfoService.getDeviceInfo()
  packNumber: string; // thường = orderCode
  orderCode?: string;

  createDate: string; // ISO
  startRecordDate: string; // ISO
  endRecordDate: string; // ISO
  timeRecordedMs: number;

  status?: PackStatus; // default 'recorded'

  videoStorage?: StorageProvider;
  videoStorageKey?: string; // local path hoặc s3 key
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
  videoResolution?: string; // "1920x1080"
  videoFrameRate?: string; // "30"
  videoChecksum?: string;

  appVersion?: string;
  ip?: string;
  tags?: string[];
  notes?: string;
}

export interface PackDoc
  extends Required<
    Pick<PackCreatePayload, "userId" | "deviceId" | "packNumber" | "createDate" | "startRecordDate" | "endRecordDate" | "timeRecordedMs">
  > {
  _id: string;
  deviceId: string;
  device?: DeviceDoc; // populated
  status: PackStatus;
  active?: boolean;
  createdAt: string;
  lastAccessAt?: string;
  deletedAt?: string | null;
  // video + extras có thể có
  orderCode?: string;
  videoStorage?: StorageProvider;
  videoStorageKey?: string;
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
  videoResolution?: string;
  videoFrameRate?: string;
  videoChecksum?: string;
  appVersion?: string;
  ip?: string;
  tags?: string[];
  notes?: string;
}

export interface PackListQuery {
  userId?: string;
  deviceId?: string;
  packNumber?: string;
  orderCode?: string;
  status?: PackStatus;
  from?: string; // ISO
  to?: string; // ISO
  search?: string;
  page?: number;
  limit?: number;
}

export interface SearchPacksResult<T> {
  packs: T[];
  pageIdx: number;
  totalItem: number;
  totalPage: number;
}
