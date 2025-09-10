import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { VerifyPhoneNumberPage } from './pages/verify-phone-number/verify-phone-number.page';
import { VerifyNamePage } from './pages/verify-name/verify-name.page';
import { VerifyOtpPage } from './pages/verify-otp/verify-otp.page';
import { VerifyPasswordPage } from './pages/verify-password/verify-password.page';
import { EnterPasswordPage } from './pages/enter-password/enter-password.page';
import { UserResidualGuard } from '@rsApp/auth/user-residual-guard.service';


const routes: Routes = [
  {
    path: '',
    component: VerifyPhoneNumberPage,
    canActivate: [UserResidualGuard]
  },
  {
    path: 'verify-name',
    component: VerifyNamePage
  },
  {
    path: 'verify-otp',
    component: VerifyOtpPage
  },
  {
    path: 'verify-password',
    component: VerifyPasswordPage
  },
  {
    path: 'enter-password',
    component: EnterPasswordPage
  },


];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AuthAccessPageRoutingModule { }
