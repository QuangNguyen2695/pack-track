import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";

import { AuthAccessPageRoutingModule } from "./auth-access-routing.module";

import { VerifyPhoneNumberPage } from "./pages/verify-phone-number/verify-phone-number.page";
import { VerifyNamePage } from "./pages/verify-name/verify-name.page";
import { VerifyOtpPage } from "./pages/verify-otp/verify-otp.page";
import { NgxOtpInputComponent, NgxOtpInputComponentOptions } from "ngx-otp-input";
import { VerifyPasswordPage } from "./pages/verify-password/verify-password.page";
import { EnterPasswordPage } from "./pages/enter-password/enter-password.page";
import { NZModule } from "@rsApp/library-modules/nz-module";
import { AngularSvgIconModule } from "angular-svg-icon";

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AuthAccessPageRoutingModule,
    NZModule,
    NgxOtpInputComponent,
    ReactiveFormsModule,
    AngularSvgIconModule.forRoot(),
  ],
  declarations: [VerifyPhoneNumberPage, VerifyNamePage, VerifyOtpPage, VerifyPasswordPage, EnterPasswordPage],
})
export class AuthAccessPageModule {
  otpOptions: NgxOtpInputComponentOptions = {};
}
