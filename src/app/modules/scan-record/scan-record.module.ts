import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { RouterModule, Routes } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ScanRecordPage } from "./scan-record.page";
import { ScanRecordPageRoutingModule } from "./scan-record-routing.module";

@NgModule({
  imports: [CommonModule, IonicModule, FormsModule, ScanRecordPageRoutingModule],
  declarations: [ScanRecordPage],
})
export class ScanRecordPageModule {}
