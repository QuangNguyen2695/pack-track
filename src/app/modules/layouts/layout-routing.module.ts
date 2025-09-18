import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LayoutComponent } from "./layout.component";
import { AuthGuard } from "@rsApp/auth/auth-guard.service";

const routes: Routes = [
  {
    path: "",
    component: LayoutComponent,
    loadChildren: () => import("../tabs/tabs.module").then((m) => m.TabsPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "scan",
    loadChildren: () => import("../scan/scan.module").then((m) => m.ScanPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "scan-record",
    loadChildren: () => import("../scan-record/scan-record.module").then((m) => m.ScanRecordPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "pack-detail",
    loadChildren: () => import("../pack-detail/pack-detail.module").then((m) => m.PackDetailPageModule),
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutRoutingModule {}
