import { NgModule } from "@angular/core";
import { PreloadAllModules, RouterModule, Routes } from "@angular/router";

const routes: Routes = [
  {
    path: "",
    loadChildren: () => import("./modules/tabs/tabs.module").then((m) => m.TabsPageModule),
  },
  {
    path: "scan",
    loadChildren: () => import("./modules/scan/scan.module").then((m) => m.ScanPageModule),
  },
  {
    path: "scan-record",
    loadChildren: () => import("./modules/scan-record/scan-record.module").then((m) => m.ScanRecordPageModule),
  },
  {
    path: "pack-detail",
    loadChildren: () => import("./modules/pack-detail/pack-detail.module").then((m) => m.PackDetailPageModule),
  },
  {
    path: "pack-return-detail",
    loadChildren: () => import("./modules/pack-detail/pack-detail.module").then((m) => m.PackDetailPageModule),
  },
  {
    path: "vip-subscription",
    loadChildren: () => import("./modules/vip-subscription/vip-subscription.module").then((m) => m.VipSubscriptionPageModule),
  },
  {
    path: "billing-debug",
    loadChildren: () => import("./pages/billing-debug/billing-debug.module").then((m) => m.BillingDebugPageModule),
  },
];
@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
