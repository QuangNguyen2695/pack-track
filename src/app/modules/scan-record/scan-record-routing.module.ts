import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { ScanRecordPage } from "./scan-record.page";

const routes: Routes = [
  {
    path: "",
    component: ScanRecordPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScanRecordPageRoutingModule {}
