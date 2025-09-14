import { Component, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthAccessService } from "@rsApp/shared/services/auth-access-service/auth-access.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { Utils } from "@rsApp/shared/utils/utils";
import { UtilsModal } from "@rsApp/shared/utils/utils-modal";
import { RequestForgotPassword, RequestResetPassword } from "../../model/auth.model";

@Component({
  selector: "app-enter-password",
  templateUrl: "./enter-password.page.html",
  styleUrls: ["./enter-password.page.scss"],
  standalone: false,
})
export class EnterPasswordPage implements OnInit {
  passwordVisible = false;
  confirmPasswordVisible = false;

  enterPasswordForm!: FormGroup;

  passwordConditions: { [key: string]: boolean } = {
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
  };

  userResidual!: any;

  mode: "register" | "update-password" = "register";
  token!: string;

  constructor(
    private authAccessService: AuthAccessService,
    private router: Router,
    private fb: FormBuilder,
    private utils: Utils,
    private utilsModal: UtilsModal,
    private credentialService: CredentialService,
  ) {}

  ngOnInit() {
    this.getQueryParams();
    this.initForm();
    this.initData();
  }

  getQueryParams() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.mode = navigation.extras.state["mode"];
      this.token = navigation.extras.state["token"];
    }
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
    this.enterPasswordForm = this.fb.group(
      {
        password: [
          "@Solid2023",
          [
            Validators.required,
            this.optionalValidator(Validators.compose([Validators.minLength(8), this.passwordValidator.bind(this)]) || (() => null)),
          ],
        ],
        confirmPassword: ["@Solid2023", [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator, // Sử dụng form-level validator
      },
    );
  }

  get f() {
    return this.enterPasswordForm.controls;
  }

  clearValueForm(controlName: string) {
    this.f[controlName].patchValue("");
    this.f[controlName].markAsTouched();
    this.f[controlName].markAsDirty();
    this.f[controlName].updateValueAndValidity();
  }

  passwordMatchValidator = (formGroup: FormGroup) => {
    const password = formGroup.get("password")?.value;
    const confirmPassword = formGroup.get("confirmPassword")?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      formGroup.get("confirmPassword")?.setErrors({ passwordMismatch: true });
      console.log("🚀 ~ EnterPasswordPage ~ initForm ~ this.enterPasswordForm:", this.enterPasswordForm);

      return { passwordMismatch: true };
    } else {
      // Clear error nếu passwords match
      const confirmPasswordControl = formGroup.get("confirmPassword");
      if (confirmPasswordControl?.errors?.["passwordMismatch"]) {
        delete confirmPasswordControl.errors["passwordMismatch"];
        if (Object.keys(confirmPasswordControl.errors).length === 0) {
          confirmPasswordControl.setErrors(null);
        }
      }
    }
    return null;
  };

  optionalValidator(validator: ValidatorFn): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value || control.value.trim() === "") {
        return null; // Không validate nếu không có giá trị
      }
      return validator(control); // Thực hiện validate khi có giá trị
    };
  }

  passwordValidator(control: any) {
    const value = control.value;
    this.passwordConditions["minLength"] = value.length >= 8;
    this.passwordConditions["hasWordCase"] = /[A-Z]/.test(value) && /[a-z]/.test(value);
    this.passwordConditions["hasNumber"] = /\d/.test(value);
    this.passwordConditions["hasSpecial"] = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    console.log("🚀 ~ SignUpComponent ~ passwordValidator ~ value:", value);
    this.passwordConditions["noneSpace"] = !/\s/.test(value);

    if (
      this.passwordConditions["minLength"] &&
      this.passwordConditions["hasWordCase"] &&
      this.passwordConditions["hasSpecial"] &&
      this.passwordConditions["hasNumber"] &&
      this.passwordConditions["noneSpace"]
    ) {
      return null;
    } else {
      return { passwordInvalid: true };
    }
  }
  onSubmit() {
    if (!this.enterPasswordForm.valid) {
      this.utils.markFormGroupTouched(this.enterPasswordForm);
      return;
    }

    const { password } = this.enterPasswordForm.getRawValue();
    if (this.mode === "register") this.updatePassword(password);
    else if (this.mode === "update-password") this.resetPassword(password);
  }

  resetPassword(password: string) {
    const requestResetPassword: RequestResetPassword = {
      token: this.token,
      newPassword: password,
    };

    this.authAccessService.resetPassword(requestResetPassword).subscribe((res: any) => {
      if (res.error) {
        this.utilsModal.presentCusToast(res.message);
        return;
      }
      this.router.navigateByUrl(`auth-access/verify-password`);
    });
  }

  updatePassword(password: string) {
    this.authAccessService.updatePassword(password).subscribe((res: any) => {
      if (res.error) {
        this.utilsModal.presentCusToast(res.message);
        return;
      }
      this.router.navigateByUrl(`tabs/home`);
    });
  }

  handleBeforeBack() {
    if (this.mode === "update-password") {
      this.router.navigateByUrl(`/auth-access/verify-password`);
      return;
    }
    this.router.navigateByUrl(`/auth-access`);
  }
}
