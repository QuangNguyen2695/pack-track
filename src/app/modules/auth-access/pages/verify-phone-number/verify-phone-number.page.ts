import { Component, OnInit } from "@angular/core";
import { AuthService } from "../../../../shared/services/auth-service/auth.service";
import { Router } from "@angular/router";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { Utils } from "@rsApp/shared/utils/utils";

@Component({
  selector: "app-verify-phone-number",
  templateUrl: "./verify-phone-number.page.html",
  styleUrls: ["./verify-phone-number.page.scss"],
  standalone: false,
})
export class VerifyPhoneNumberPage implements OnInit {
  verifyPhoneNumberForm!: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private credentialService: CredentialService,
    private utils: Utils,
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.verifyPhoneNumberForm = this.fb.group({
      phoneNumber: ["0961090222", [Validators.required, Validators.pattern(this.utils.VN_MOBILE_REX)]],
    });
  }

  get f() {
    return this.verifyPhoneNumberForm.controls;
  }

  clearValueForm(controlName: string) {
    this.f[controlName].patchValue("");
    this.f[controlName].markAsTouched();
    this.f[controlName].markAsDirty();
    this.f[controlName].updateValueAndValidity();
  }

  onSubmit() {
    if (!this.verifyPhoneNumberForm.valid) {
      this.utils.markFormGroupTouched(this.verifyPhoneNumberForm);
      return;
    }

    const { phoneNumber } = this.verifyPhoneNumberForm.getRawValue();

    this.verifyPhoneNumber(phoneNumber);
  }

  verifyPhoneNumber(phoneNumber: string) {
    this.authService.verifyPhoneNumber(phoneNumber).subscribe(async (res: any) => {
      const userResidual: { phoneNumber: string; name?: string } = { phoneNumber: phoneNumber };
      if (res) {
        userResidual.name = res;
      }
      const url = res ? "verify-password" : "verify-name";
      await this.credentialService.setUserResidual(userResidual);
      this.router.navigateByUrl(`/auth-access/${url}`);
    });
  }
}
