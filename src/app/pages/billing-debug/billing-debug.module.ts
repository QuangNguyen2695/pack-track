import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";

import { BillingDebugPage } from "./billing-debug.page";
import { BillingDebugPageRoutingModule } from "./billing-debug-routing.module";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BillingDebugPageRoutingModule, BillingDebugPage],
})
export class BillingDebugPageModule {}
