import { CUSTOM_ELEMENTS_SCHEMA, inject, NgModule, provideAppInitializer } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { RouteReuseStrategy } from "@angular/router";

import { IonicModule, IonicRouteStrategy } from "@ionic/angular";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NZModule } from "./library-modules/nz-module";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { FilterPipe } from "./shared/pipe/filter-pipe";
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { TokenInterceptor } from "./Interceptor/token.interceptor";
import { LoadingInterceptor } from "./Interceptor/loading-interceptor";
import { LoaddingScreenComponent } from "./shared/component/loadding-screen/loadding-screen.component";
import { SyncStatusWidgetComponent } from "./shared/components/sync-status-widget/sync-status-widget.component";
import { NgxSonnerToaster } from "ngx-sonner";

// ng-zorro-antd i18n
import { NZ_I18N, vi_VN } from "ng-zorro-antd/i18n";
import { registerLocaleData } from "@angular/common";
import vi from "@angular/common/locales/vi";
import { QuotaInterceptor } from "./Interceptor/quota.interceptor";
import { AuthService } from "./shared/services/auth-service/auth.service";

registerLocaleData(vi);

function initAuth() {
  // chạy lúc bootstrap, có injection context
  const auth = inject(AuthService);
  return auth.init(); // Promise<void> | Observable<any> đều OK
}

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NZModule,
    ScrollingModule,
    FilterPipe,
    LoaddingScreenComponent,
    SyncStatusWidgetComponent,
    NgxSonnerToaster,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
    { provide: NZ_I18N, useValue: vi_VN },
    { provide: HTTP_INTERCEPTORS, useClass: QuotaInterceptor, multi: true },
    provideAppInitializer(initAuth),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
