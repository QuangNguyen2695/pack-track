import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(private credentialService: CredentialService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return new Observable((observer) => {
      this.credentialService
        .getToken()
        .then((token) => {
          if (token) {
            const cloned = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${token}`),
            });
            next.handle(cloned).subscribe({
              next: (event) => observer.next(event),
              error: (err) => observer.error(err),
              complete: () => observer.complete(),
            });
          } else {
            next.handle(req).subscribe({
              next: (event) => observer.next(event),
              error: (err) => observer.error(err),
              complete: () => observer.complete(),
            });
          }
        })
        .catch((err) => observer.error(err));
    });
  }
}
