import { Injectable } from "@angular/core";
import { CookieService as NgxCookieService } from "ngx-cookie-service";

@Injectable({
  providedIn: "root",
})
export class CookieService {
  constructor(private cookieService: NgxCookieService) {}

  set(key: string, value: any, expireDays: number = 30): void {
    const date = new Date();
    date.setTime(date.getTime() + expireDays * 24 * 60 * 60 * 1000);
    this.cookieService.set(key, JSON.stringify(value), date, "/");
  }

  get(key: string): any {
    const value = this.cookieService.get(key);
    const data = value ? JSON.parse(value) : null;
    return !data || !data.error ? data : null;
  }

  remove(key: string): void {
    this.cookieService.delete(key, "/");
  }

  clear(): void {
    this.cookieService.deleteAll("/");
  }
}
