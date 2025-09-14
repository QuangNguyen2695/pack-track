import { Component, OnInit, Renderer2 } from "@angular/core";
import { Router } from "@angular/router";
import { AuthAccessService } from "@rsApp/shared/services/auth-access-service/auth-access.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { UtilsModal } from "@rsApp/shared/utils/utils-modal";
import { NgxOtpStatus } from "ngx-otp-input";
import { NgxOtpInputComponentOptions } from "ngx-otp-input";
import { toast } from "ngx-sonner";
import { RequestForgotPassword, VerifyAuthRescue } from "../../model/auth.model";

@Component({
  selector: "app-verify-otp",
  templateUrl: "./verify-otp.page.html",
  styleUrls: ["./verify-otp.page.scss"],
  standalone: false,
})
export class VerifyOtpPage implements OnInit {
  otpOptions: NgxOtpInputComponentOptions = { autoFocus: true, otpLength: 6 };

  otp: any;
  status = NgxOtpStatus;
  userResidual!: any;
  mode: "register" | "update-password" = "register";

  constructor(
    private router: Router,
    private authAccessService: AuthAccessService,
    private utilsModal: UtilsModal,
    private credentialService: CredentialService,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.initData();
    this.getQueryParams();
  }

  ionViewDidEnter() {
    this.setFocus();
  }

  getQueryParams() {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.mode = navigation.extras.state["mode"];
      console.log("🚀 ~ VerifyOtpPage ~ getQueryParams ~ this.mode:", this.mode);
    }
  }

  setFocus() {
    const firstInput = document.querySelector("input");
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
    this.otp = otp.join("");
    console.log("OTP:", this.otp);
    if (this.otp.length === 6) {
      this.submitOtp();
    }
  }

  resendOtp() {
    this.authAccessService.sendOtp(this.userResidual.phoneNumber).subscribe((res: any) => {
      if (!res) {
        toast.error("Gửi lại mã OTP không thành công");
      }
      toast.success("Gửi lại mã OTP thành công");
    });
  }

  submitOtp() {
    const verifyAuthRescue: VerifyAuthRescue = {
      identifier: this.userResidual.phoneNumber,
      purpose: "2fa",
      token: this.otp,
    };

    this.authAccessService.validateOtp(verifyAuthRescue).subscribe((res: any) => {
      if (!res || res.error) {
        toast.error("Xác thực OTP không thành công");
        return;
      }

      if (this.mode === "update-password") {
        this.forgotPassword();
        return;
      }
      this.register();
    });
  }

  forgotPassword() {
    const requestForgotPassword: RequestForgotPassword = {
      identifier: this.userResidual.phoneNumber,
    };
    this.authAccessService.forgotPasswordInApp(requestForgotPassword).subscribe((res: any) => {
      if (!res || res.error) {
        toast.error("Xác thực OTP không thành công");
        return;
      }
      this.router.navigateByUrl("/auth-access/enter-password", { state: { mode: "update-password", token: res.token } });
      return;
    });
  }

  register() {
    this.authAccessService.register(this.userResidual.phoneNumber, this.userResidual.name).subscribe((res: any) => {
      if (res?.user) {
        this.authAccessService.login(this.userResidual.phoneNumber, "password123").subscribe((loginRes: any) => {
          if (loginRes.error) {
            // this.utilsModal.presentCusToast(loginRes.message);
            return;
          } else {
            this.router.navigateByUrl("/auth-access/enter-password");
          }
        });
      } else {
        // this.utilsModal.presentCusToast('Đăng ký không thành công');
      }
    });
  }
}
