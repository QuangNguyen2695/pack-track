import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";

import { NZModule } from "@rsApp/library-modules/nz-module";
import { CameraPreview } from "@awesome-cordova-plugins/camera-preview/ngx";
import { AndroidPermissions } from "@awesome-cordova-plugins/android-permissions/ngx";
import { PackDetailPage } from "./pack-detail.page";
import { PackDetailPageRoutingModule } from "./pack-detail-routing.module";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, NZModule, PackDetailPageRoutingModule],
  declarations: [PackDetailPage],
  providers: [CameraPreview, AndroidPermissions],
})
export class PackDetailPageModule {}
