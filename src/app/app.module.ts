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
import { LoadingInterceptor } from "./Interceptor/loading-interceptor";
import { LoaddingScreenComponent } from "./shared/component/loadding-screen/loadding-screen.component";
import { SyncStatusWidgetComponent } from "./shared/components/sync-status-widget/sync-status-widget.component";
import { RecoveryStatusWidgetComponent } from "./shared/components/recovery-status-widget/recovery-status-widget.component";
import { NgxSonnerToaster } from "ngx-sonner";

// ng-zorro-antd i18n
import { NZ_I18N, vi_VN } from "ng-zorro-antd/i18n";
import { registerLocaleData } from "@angular/common";
import vi from "@angular/common/locales/vi";
import { IonicStorageModule } from "@ionic/storage-angular";

registerLocaleData(vi);

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
    RecoveryStatusWidgetComponent,
    NgxSonnerToaster,
    IonicStorageModule.forRoot(),
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true,
    },
    { provide: NZ_I18N, useValue: vi_VN },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
