import { Injectable } from "@angular/core";
import { Device } from "@capacitor/device";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { DeviceInfoPayload, DevicePlatform } from "@rsApp/shared/models/device.model";

@Injectable({ providedIn: "root" })
export class DeviceInfoService {
  private readonly INSTALLATION_KEY = "installation_id";
  private cachedInstallationId: string | null = null;

  async getDeviceInfo(): Promise<DeviceInfoPayload> {
    const [id, info, app] = await Promise.all([Device.getId(), Device.getInfo(), App.getInfo()]);

    const installationId = await this.ensureInstallationId();

    const locale = navigator.language;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // ép kiểu platform
    const platform = (info.platform as DevicePlatform) || "web";

    return {
      deviceId: id.identifier,
      installationId,
      platform, // giờ đã đúng type
      appVersion: app.version ?? "unknown",
      osVersion: String(info.osVersion ?? ""),
      modelDevice: info.model ?? "",
      manufacturer: info.manufacturer ?? "",
      locale,
      timeZone,
    };
  }

  private async ensureInstallationId(): Promise<string> {
    if (this.cachedInstallationId) return this.cachedInstallationId;
    const stored = await Preferences.get({ key: this.INSTALLATION_KEY });
    if (stored.value) {
      this.cachedInstallationId = stored.value;
      return stored.value;
    }
    const fresh = this.generateUuid();
    await Preferences.set({ key: this.INSTALLATION_KEY, value: fresh });
    this.cachedInstallationId = fresh;
    return fresh;
  }

  private generateUuid(): string {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const b = Array.from(buf, toHex).join("");
    return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
  }
}
