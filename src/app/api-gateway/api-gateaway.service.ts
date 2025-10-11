import { HttpClient, HttpHeaders, HttpContext, HttpParams, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { SkipLoading } from "@rsApp/Interceptor/loading-interceptor";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { ENV } from "src/environments/environment.development";

interface RequestOptions {
  skipLoading?: boolean; // bật/tắt loading ở interceptor
  feature?: {
    // quota feature headers
    module: string;
    function?: string | null;
  };
  extraHeaders?: Record<string, string> | HttpHeaders; // headers bổ sung
}

@Injectable({
  providedIn: "root",
})
export class ApiGatewayService {
  protected api = ENV.apiUrl;

  constructor(private http: HttpClient) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }

  private createHeaders(options: RequestOptions): { headers: HttpHeaders; context: HttpContext } {
    const { skipLoading = false, feature, extraHeaders } = options;

    let headers = new HttpHeaders();
    let context = new HttpContext().set(SkipLoading, skipLoading);

    if (feature?.module) {
      headers = headers.set("X-Feature-Module", feature.module);
      if (feature.function) {
        headers = headers.set("X-Feature-Function", feature.function);
      } else {
        // đảm bảo không còn header cũ nếu tái sử dụng headers
        headers = headers.delete("X-Feature-Function");
      }
    }

    if (extraHeaders) {
      if (extraHeaders instanceof HttpHeaders) {
        // merge HttpHeaders
        extraHeaders.keys().forEach((k) => {
          const v = extraHeaders.getAll(k);
          if (v) v.forEach((val) => (headers = headers.append(k, val)));
        });
      } else {
        // merge từ object
        Object.entries(extraHeaders).forEach(([k, v]) => {
          headers = headers.set(k, String(v));
        });
      }
    }

    headers = headers.set("Access-Control-Allow-Origin", "*");
    headers = headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE,PUT");
    headers = headers.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization",
    );

    return { headers, context };
  }

  request(method: string, url: string, body: any = null, options: RequestOptions = {}): Observable<any> {
    const { headers, context } = this.createHeaders(options);
    url = this.api + url;

    switch (method) {
      case "GET":
        return this.http.get(url, { headers, context, params: body }).pipe(catchError(this.handleError.bind(this)));
      case "POST":
        return this.http.post(url, body, { headers, context }).pipe(catchError(this.handleError.bind(this)));
      case "PUT":
        return this.http.put(url, body, { headers, context }).pipe(catchError(this.handleError.bind(this)));
      case "DELETE":
        return this.http.delete(url, { headers, context }).pipe(catchError(this.handleError.bind(this)));
      default:
        throw new Error("Unsupported request method");
    }
  }

  get(url: string, params: any = null, options: RequestOptions = {}): Observable<any> {
    return this.request("GET", url, params, options);
  }

  post(url: string, body: any, options: RequestOptions = {}): Observable<any> {
    return this.request("POST", url, body, options);
  }

  put(url: string, body: any, options: RequestOptions = {}): Observable<any> {
    return this.request("PUT", url, body, options);
  }

  delete(url: string, options: RequestOptions = {}): Observable<any> {
    return this.request("DELETE", url, null, options);
  }
}
