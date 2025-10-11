import { Injectable } from "@angular/core";
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse, HttpErrorResponse } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { toast } from "ngx-sonner";
import { CapsService } from "@rsApp/shared/services/caps-service/caps.service";

@Injectable()
export class QuotaInterceptor implements HttpInterceptor {
  constructor(private caps: CapsService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const moduleKey = req.headers.get("X-Feature-Module") ?? "";
    const functionKey = req.headers.get("X-Feature-Function") ?? "";

    return next.handle(req).pipe(
      tap({
        next: async (evt) => {
          if (evt instanceof HttpResponse && moduleKey) {
            const remaining = num(evt.headers.get("X-RateLimit-Remaining"));
            let resetAt = num(evt.headers.get("X-RateLimit-Reset"));
            if (resetAt == null) {
              const iso = evt.headers.get("X-RateLimit-Reset");
              if (iso) {
                const ms = Date.parse(iso);
                if (!Number.isNaN(ms)) resetAt = ms;
              }
            }
            await this.caps.applyQuotaUpdate(moduleKey, functionKey || null, remaining ?? undefined, resetAt ?? undefined);
          }
        },
        error: async (err) => {
          if (err instanceof HttpErrorResponse && err.status === 429 && moduleKey) {
            let resetAtMs: number | null = null;
            const body = err.error ?? {};
            if (body?.resetAt) resetAtMs = typeof body.resetAt === "number" ? body.resetAt : Date.parse(body.resetAt) || null;
            await this.caps.applyQuotaUpdate(moduleKey, functionKey || null, 0, resetAtMs ?? undefined);
            const t = await toast.error("You have exceeded your quota for this feature.");
          }
        },
      }),
    );
  }
}
function num(x: string | null): number | null {
  if (x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
