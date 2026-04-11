import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";
import { VipSubscriptionPage } from "./vip-subscription.page";

const routes: Routes = [
  {
    path: "",
    component: VipSubscriptionPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VipSubscriptionPageRoutingModule {}
