// Model (DTO) & types dùng ở FE cho module Device

export type DevicePlatform = "ios" | "android" | "web";

export interface DeviceRegisterPayload {
  userId: string;

  // device identity
  deviceId: string; // UUID phần cứng
  installationId: string; // UUID cài đặt app

  // platform & versions
  platform: DevicePlatform;
  appVersion: string;
  osVersion: string;

  // hardware
  modelDevice: string;
  manufacturer: string;

  // push & settings
  pushToken?: string;
  notificationEnabled?: boolean;

  // context
  locale?: string;
  timeZone?: string;
  ip?: string;
  carrier?: string;

  // flags
  isPrimary?: boolean;
}

export interface DeviceUpdatePushPayload {
  pushToken: string;
  enabled?: boolean;
}

export interface DeviceDoc {
  _id: string;
  userId: string;

  deviceId: string;
  installationId: string;

  platform: DevicePlatform;
  appVersion: string;
  osVersion: string;

  modelDevice: string;
  manufacturer: string;

  pushToken?: string;
  notificationEnabled?: boolean;

  locale?: string;
  timeZone?: string;
  ip?: string;
  carrier?: string;

  isPrimary: boolean;
  lastActiveAt: string;
  createdAt: string;
  active: boolean;
}

export interface DeviceListQuery {
  userId?: string;
  platform?: DevicePlatform;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DeviceInfoPayload {
  deviceId: string; // ID phần cứng (Capacitor Device.getId)
  installationId: string; // ID cài đặt app (tự sinh & lưu Preferences)
  platform: string; // ios | android | web
  appVersion: string;
  osVersion: string;
  modelDevice: string;
  manufacturer: string;
  locale?: string;
  timeZone?: string;
}
