import {
  HttpClient,
  HttpHeaders,
  HttpContext,
  HttpParams,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ENV } from 'src/environments/environment.development';
import { SkipLoading } from '@rsApp/Interceptor/loading-interceptor';

@Injectable({
  providedIn: 'root',
})
export class ApiGatewayService {
  protected api = ENV.apiUrl;

  constructor(private http: HttpClient) {}
  private createHeaders(skipLoading: boolean): {
    headers: HttpHeaders;
    context: HttpContext;
  } {
    let headers = new HttpHeaders();
    let context = new HttpContext().set(SkipLoading, skipLoading);

    // Do not set CORS response headers on client requests.
    // Servers must send Access-Control-Allow-* headers. Setting them here can break preflight.
    // Keep minimal, safe defaults; Angular will set Content-Type for JSON bodies automatically.
    headers = headers.set('Accept', 'application/json');

    return { headers, context };
  }

  request(
    method: string,
    url: string,
    body: any = null,
    skipLoading: boolean = false
  ): Observable<any> {
    const { headers, context } = this.createHeaders(skipLoading);
    url = this.api + url;

    switch (method) {
      case 'GET':
        return this.http.get(url, { headers, context });
      case 'POST':
        return this.http.post(url, body, { headers, context });
      case 'PUT':
        return this.http.put(url, body, { headers, context });
      case 'DELETE':
        return this.http.delete(url, { headers, context });
      default:
        throw new Error('Unsupported request method');
    }
  }

  get(url: string, skipLoading: boolean = false): Observable<any> {
    return this.request('GET', url, null, skipLoading);
  }

  post(url: string, body: any, skipLoading: boolean = false): Observable<any> {
    return this.request('POST', url, body, skipLoading);
  }

  put(url: string, body: any, skipLoading: boolean = false): Observable<any> {
    return this.request('PUT', url, body, skipLoading);
  }

  delete(url: string, skipLoading: boolean = false): Observable<any> {
    return this.request('DELETE', url, null, skipLoading);
  }
}
