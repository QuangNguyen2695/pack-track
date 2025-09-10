import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";

import { ScanPageRoutingModule } from "./scan-routing.module";

import { ScanPage } from "./scan.page";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { CameraPreview } from "@awesome-cordova-plugins/camera-preview/ngx";
import { AndroidPermissions } from "@awesome-cordova-plugins/android-permissions/ngx";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ScanPageRoutingModule, NZModule],
  declarations: [ScanPage],
  providers: [CameraPreview, AndroidPermissions],
})
export class ScanPageModule {}
