import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { ApiGatewayService } from "@rsApp/api-gateway/api-gateaway.service";
import { CookieService } from "../cookie-service/cookie.service";

export interface CapabilityItem {
  moduleKey: string;
  functionKey: string | null; // null = module-level
  type: "unlimited" | "count"; // FE KHÔNG cần biết useFull, BE đã map sang 'unlimited'
  quota: number | null;
  remaining: number | null;
  resetAt: string | null; // ISO
}
export interface CapabilitiesRes {
  defaultAction: "allow" | "block";
  items: CapabilityItem[];
}

const COOKIE_KEY = "caps:v1";
const COOKIE_EXPIRE_DAYS = 30; // tuỳ bạn

@Injectable({ providedIn: "root" })
export class CapsService {
  url = "/user-subscription-usage/capabilities";

  private subject = new BehaviorSubject<CapabilitiesRes | null>(null);
  caps$ = this.subject.asObservable();

  private nextRefreshAt: number | null = null;
  private refreshTimer: any;
  items$: any;

  constructor(private api: ApiGatewayService, private cookie: CookieService) {}

  /** Gọi 1 lần sau login */
  async bootstrap(): Promise<void> {
    // 1) lấy cache từ cookie để UI hiển thị tức thì
    const cached = this.cookie.get(COOKIE_KEY) as unknown as CapabilitiesRes | null;
    if (cached) {
      this.subject.next(cached);
      this.computeNextRefresh(cached);
      this.armRefreshTimer();
    }

    // 2) đồng bộ mới từ server (không chặn UI)
    try {
      const fresh: CapabilitiesRes = await this.api.get(this.url).toPromise();
      if (fresh) await this.setCaps(fresh);
    } catch {
      // bỏ qua lỗi mạng: giữ cache cũ
    }
  }

  async clear() {
    this.subject.next(null);
    this.nextRefreshAt = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.cookie.remove(COOKIE_KEY);
  }

  /** Interceptor gọi để cập nhật nhanh sau mỗi request */
  async applyQuotaUpdate(moduleKey: string, functionKey: string | null, remaining?: number | null, resetAtMs?: number | null) {
    const cur = this.subject.value;
    if (!cur) return;
    const it = cur.items.find((i) => i.moduleKey === moduleKey && (i.functionKey ?? "") === (functionKey ?? ""));
    if (!it) return;
    if (typeof remaining === "number") it.remaining = Math.max(0, remaining);
    if (typeof resetAtMs === "number") it.resetAt = new Date(resetAtMs).toISOString();
    await this.setCaps({ ...cur, items: [...cur.items] });
  }

  // ===== helpers cho UI =====
  visible(moduleKey: string, functionKey?: string | null): boolean {
    const cur = this.subject.value;
    if (!cur) return true;
    const found = cur.items.find((i) => i.moduleKey === moduleKey && (i.functionKey ?? "") === (functionKey ?? ""));
    return found ? true : cur.defaultAction === "allow";
  }

  disabled(moduleKey: string, functionKey?: string | null): boolean {
    const cur = this.subject.value;
    if (!cur) return false;
    const it = cur.items.find((i) => i.moduleKey === moduleKey && (i.functionKey ?? "") === (functionKey ?? ""));
    if (!it) return cur.defaultAction !== "allow";
    if (it.type === "unlimited") return false;
    return (it.remaining ?? 0) <= 0;
  }

  remaining(moduleKey: string, functionKey?: string | null): number | null {
    const it = this.subject.value?.items.find((i) => i.moduleKey === moduleKey && (i.functionKey ?? "") === (functionKey ?? ""));
    return it?.remaining ?? null;
  }

  // ===== internal =====
  private async setCaps(v: CapabilitiesRes) {
    this.subject.next(v);
    this.cookie.set(COOKIE_KEY, v, COOKIE_EXPIRE_DAYS); // <— lưu cookie
    this.computeNextRefresh(v);
    this.armRefreshTimer();
  }

  private computeNextRefresh(v: CapabilitiesRes) {
    const times = v.items.map((i) => (i.resetAt ? Date.parse(i.resetAt) : NaN)).filter((n) => !Number.isNaN(n));
    this.nextRefreshAt = times.length ? Math.min(...times) : null;
  }

  private armRefreshTimer() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.nextRefreshAt) return;
    const delay = Math.max(0, this.nextRefreshAt - Date.now() + 1000); // +1s buffer
    this.refreshTimer = setTimeout(async () => {
      try {
        const fresh: CapabilitiesRes = await this.api.get(this.url).toPromise();
        if (fresh) await this.setCaps(fresh);
      } catch {
        /* giữ cache */
      }
    }, delay);
  }
}
