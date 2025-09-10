import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthAccessService } from '../../../../shared/services/auth-access-service/auth-access.service';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';
import { UtilsModal } from '@rsApp/shared/utils/utils-modal';

@Component({
  selector: 'app-verify-password',
  templateUrl: './verify-password.page.html',
  styleUrls: ['./verify-password.page.scss'],
  standalone: false,
})
export class VerifyPasswordPage implements OnInit {
  passwordVisible = false;
  verifyPasswordForm!: FormGroup;

  userResidual!: any;

  constructor(
    private authAccessService: AuthAccessService,
    private router: Router,
    private fb: FormBuilder,
    private utilsModal: UtilsModal,
    private credentialService: CredentialService
  ) {}

  ngOnInit() {
    this.initForm();
    this.initData();
  }

  async initData() {
    const userResidual = await this.credentialService.getUserResidual();
    if (!userResidual) {
      this.router.navigateByUrl(`/auth-access`);
      return;
    }
    this.userResidual = userResidual;
  }

  initForm() {
    this.verifyPasswordForm = this.fb.group({
      password: ['password123', [Validators.required]],
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control: any) => {
      control.markAsTouched();
      if (control.controls) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onSubmit() {
    if (!this.verifyPasswordForm.valid) {
      this.markFormGroupTouched(this.verifyPasswordForm);
      return;
    }

    const { password } = this.verifyPasswordForm.getRawValue();

    this.login(password);
  }

  login(password: string) {
    this.authAccessService
      .login(this.userResidual.phoneNumber, password)
      .subscribe(async (res: any) => {
        if (res.error) {
          this.utilsModal.presentCusToast(res.message);
          return;
        }
        this.router.navigateByUrl(`tabs/home`);
      });
  }

  async notMe() {
    await this.credentialService.removeUserResidual();
    this.router.navigateByUrl(`/auth-access`);
  }

  forgotPassword() {}

  async handleBeforeBack() {
    await this.credentialService.removeUserResidual();
    this.router.navigateByUrl(`/auth-access`);
  }
}
