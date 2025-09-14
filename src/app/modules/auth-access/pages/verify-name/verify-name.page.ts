import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthAccessService } from "../../../../shared/services/auth-access-service/auth-access.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { Utils } from "@rsApp/shared/utils/utils";

@Component({
  selector: "app-verify-name",
  templateUrl: "./verify-name.page.html",
  styleUrls: ["./verify-name.page.scss"],
  standalone: false,
})
export class VerifyNamePage implements OnInit {
  verifyNameForm!: FormGroup;
  userResidual!: any;

  constructor(
    private authAccessService: AuthAccessService,
    private router: Router,
    private fb: FormBuilder,
    private credentialService: CredentialService,
    private utils: Utils,
  ) {}

  ngOnInit() {
    this.initForm();
    this.initData();
  }

  async initData() {
    const userResidual = await this.credentialService.getUserResidual();
    if (!userResidual) {
      this.router.navigateByUrl(`/auth-access/`);
      return;
    }
    this.userResidual = userResidual;
  }

  initForm() {
    this.verifyNameForm = this.fb.group({
      name: ["", [Validators.required]],
    });
  }

  get f() {
    return this.verifyNameForm.controls;
  }

  clearValueForm(controlName: string) {
    this.f[controlName].patchValue("");
    this.f[controlName].markAsTouched();
    this.f[controlName].markAsDirty();
    this.f[controlName].updateValueAndValidity();
  }

  onSubmit() {
    if (!this.verifyNameForm.valid) {
      this.utils.markFormGroupTouched(this.verifyNameForm);
      return;
    }

    const { name } = this.verifyNameForm.getRawValue();

    this.sendOtp(name);
  }

  sendOtp(name: string) {
    this.authAccessService.sendOtp(this.userResidual.phoneNumber).subscribe(async (res: any) => {
      const userResidual = {
        phoneNumber: this.userResidual.phoneNumber,
        name: name,
      };
      await this.credentialService.setUserResidual(userResidual);
      this.router.navigateByUrl(`/auth-access/verify-otp`, { state: { mode: "register" } });
    });
  }
}
