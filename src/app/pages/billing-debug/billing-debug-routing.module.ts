import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BillingDebugPage } from './billing-debug.page';

const routes: Routes = [
  {
    path: '',
    component: BillingDebugPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BillingDebugPageRoutingModule {}
