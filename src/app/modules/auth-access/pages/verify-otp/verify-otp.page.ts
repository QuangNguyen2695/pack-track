import { Component, OnInit, Renderer2 } from '@angular/core';
import { Router } from '@angular/router';
import { AuthAccessService } from '@rsApp/shared/services/auth-access-service/auth-access.service';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';
import { UtilsModal } from '@rsApp/shared/utils/utils-modal';
import { NgxOtpStatus } from 'ngx-otp-input';
import { NgxOtpInputComponentOptions } from 'ngx-otp-input';

@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.page.html',
  styleUrls: ['./verify-otp.page.scss'],
  standalone: false,
})
export class VerifyOtpPage implements OnInit {
  otpOptions: NgxOtpInputComponentOptions = { autoFocus: true, otpLength: 6 };

  otp: any;
  status = NgxOtpStatus;
  userResidual!: any;

  constructor(
    private router: Router,
    private authAccessService: AuthAccessService,
    private utilsModal: UtilsModal,
    private credentialService: CredentialService,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.initData();
  }

  ionViewDidEnter() {
    this.setFocus();
  }

  setFocus() {
    const firstInput = document.querySelector('input');
    if (firstInput) {
      this.renderer.selectRootElement(firstInput).focus();
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

  handleOtpChange(otp: any) {
    this.otp = otp.join('');
    console.log('OTP:', this.otp);
    if (this.otp.length === 6) {
      this.submitOtp();
    }
  }

  submitOtp() {
    this.authAccessService
      .register(this.userResidual.phoneNumber, this.userResidual.name)
      .subscribe((res: any) => {
        if (res?.user) {
          this.authAccessService
            .login(this.userResidual.phoneNumber, 'password123')
            .subscribe((loginRes: any) => {
              if (loginRes.error) {
                // this.utilsModal.presentCusToast(loginRes.message);
              } else {
                this.router.navigateByUrl('/auth-access/enter-password');
              }
            });
        } else {
          // this.utilsModal.presentCusToast('Đăng ký không thành công');
        }
      });
  }
}
