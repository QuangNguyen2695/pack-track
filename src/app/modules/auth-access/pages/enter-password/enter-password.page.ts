import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthAccessService } from '@rsApp/shared/services/auth-access-service/auth-access.service';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';
import { Utils } from '@rsApp/shared/utils/utils';
import { UtilsModal } from '@rsApp/shared/utils/utils-modal';

@Component({
  selector: 'app-enter-password',
  templateUrl: './enter-password.page.html',
  styleUrls: ['./enter-password.page.scss'],
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

  constructor(
    private authAccessService: AuthAccessService,
    private router: Router,
    private fb: FormBuilder,
    private utils: Utils,
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
      this.router.navigateByUrl(`/auth-access/`);
      return;
    }
    this.userResidual = userResidual;
  }

  initForm() {
    this.enterPasswordForm = this.fb.group(
      {
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            this.passwordValidator.bind(this),
          ],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validator: this.checkPasswords }
    );
  }

  checkPasswords(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notSame: true };
  }

  passwordValidator(control: any) {
    const value = control.value;
    this.passwordConditions['minLength'] = value.length >= 8;
    this.passwordConditions['hasUpperCase'] = /[A-Z]/.test(value);
    this.passwordConditions['hasLowerCase'] = /[a-z]/.test(value);
    this.passwordConditions['hasNumber'] = /\d/.test(value);

    if (
      this.passwordConditions['minLength'] &&
      this.passwordConditions['hasUpperCase'] &&
      this.passwordConditions['hasLowerCase'] &&
      this.passwordConditions['hasNumber']
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

    this.updatePassword(password);
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
}
