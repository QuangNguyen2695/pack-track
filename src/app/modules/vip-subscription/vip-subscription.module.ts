import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";

import { VipSubscriptionPage } from "./vip-subscription.page";
import { VipSubscriptionPageRoutingModule } from "./vip-subscription-routing.module";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, VipSubscriptionPageRoutingModule],
  declarations: [VipSubscriptionPage],
})
export class VipSubscriptionPageModule {}
