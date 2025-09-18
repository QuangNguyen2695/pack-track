import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { PackDetailPage } from "./pack-detail.page";

const routes: Routes = [
  {
    path: "",
    component: PackDetailPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PackDetailPageRoutingModule {}
