import { IonicModule } from "@ionic/angular";
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { TabsPageRoutingModule } from "./tabs-routing.module";

import { TabsPage } from "./tabs.page";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { HomePage } from "./home/home.page";
import { PacksListPage } from "./packs-list/packs-list.page";

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonicModule, CommonModule, FormsModule, TabsPageRoutingModule, NZModule, HomePage, PacksListPage],
  declarations: [TabsPage],
})
export class TabsPageModule {}
