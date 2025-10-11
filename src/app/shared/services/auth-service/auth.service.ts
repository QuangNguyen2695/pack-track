import { Injectable, signal } from "@angular/core";
import { defer, from, of, throwError } from "rxjs";
import { catchError, delay, filter, map, mergeMap, switchMap, take, tap } from "rxjs/operators";
import { ApiGatewayService } from "src/app/api-gateway/api-gateaway.service";
import { CredentialService } from "@rsApp/shared/services/credential-service/credential.service";
import { RequestAuthRescue, RequestForgotPassword, RequestResetPassword, VerifyAuthRescue } from "@rsApp/modules/auth-access/model/auth.model";
import { DeviceInfoService } from "../device/device-info.service";
import { DeviceAccessService } from "../device/device-access.service";
import { DevicePlatform } from "@rsApp/shared/models/device.model";
import { CapsService } from "../caps-service/caps.service";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  initialized = signal(false);

  constructor(
    private apiGatewayService: ApiGatewayService,
    private credentialService: CredentialService,
    private deviceInfoService: DeviceInfoService,
    private deviceAccessService: DeviceAccessService,
    private capsService: CapsService,
  ) {}

  async init(): Promise<void> {
    try {
      const token = await this.credentialService.getToken();
      if (!token) {
        this.credentialService.removeCurrentUser();
        this.credentialService.removeToken();
        return;
      }
      const currentUser = await this.getCurrentUser().toPromise();
      await this.capsService.bootstrap();
      this.credentialService.setCurrentUser(currentUser);
    } catch {
      this.credentialService.removeCurrentUser();
      this.credentialService.removeToken();
    } finally {
      this.initialized.set(true);
    }
  }

  login(phoneNumber: string, password: string) {
    const body = { phoneNumber, password };
    const url = `/auth/login?phoneNumber=${encodeURIComponent(phoneNumber)}`;

    return this.apiGatewayService.post(url, body).pipe(
      map((res: any) => res?.access_token),
      filter((token): token is string => !!token), // chỉ đi tiếp khi có token
      switchMap((token) => this.handleAuthenticationSuccess(token)),
      take(1),
      catchError((error) => {
        console.error("Login error:", error);
        return throwError(() => error); // để caller xử lý
      }),
    );
  }

  /**
   * Đặt token -> lấy current user -> lưu current user -> bootstrap caps
   * Trả về Observable<User | null>
   */
  private handleAuthenticationSuccess(accessToken: string) {
    return defer(() => from(this.credentialService.setToken(accessToken))).pipe(
      switchMap(() => this.getCurrentUser()),
      switchMap((user: any) => {
        if (!user) return of(null);
        // đảm bảo setCurrentUser hoàn tất trước khi trả user
        return from(this.credentialService.setCurrentUser(user)).pipe(
          tap(() => {
            this.capsService.bootstrap();
          }), // <— refresh menu theo role mới
          map(() => user),
        );
      }),
      catchError((err) => {
        console.error("handleAuthenticationSuccess error:", err);
        const msg = err?.error?.message || err.message || "Unexpected error";
        // ví dụ: show toast ở ngoài; ở đây rethrow để tầng gọi xử lý
        return throwError(() => err);
      }),
    );
  }

  verifyPhoneNumber(phoneNumber: string) {
    const url = `/auth/verify-phoneNumber?phoneNumber=${phoneNumber}`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {
        console.log("🚀 ~ AuthAccessService ~ map ~ res:", res);
      }),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        console.log("🚀 ~ AuthAccessService ~ catchError ~ error:", error);
        //write log
        return of([]);
      }),
    );
  }

  sendAuthRescue(requestAuthRescue: RequestAuthRescue) {
    const url = `/auth/rescue/request`;
    return this.apiGatewayService.post(url, requestAuthRescue).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of([]);
      }),
    );
  }

  validateAuthRescue(verifyAuthRescue: VerifyAuthRescue) {
    const url = `/auth/rescue/verify`;
    return this.apiGatewayService.post(url, verifyAuthRescue).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  register(phoneNumber: string, name: string) {
    const url = `/users/register`;
    const user = {
      phoneNumber,
      name,
      password: "password123",
      isTempPassWord: true,
    };
    return this.apiGatewayService.post(url, user).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((err) => {
        //write log
        return of(err.error);
      }),
    );
  }

  getNameByPhone(phoneNumber: string) {
    const url = `/user/getNameByPhone?phoneNumber=${phoneNumber}`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of([]);
      }),
    );
  }

  async logout() {
    await this.credentialService.removeToken();
    await this.credentialService.removeCurrentUser();
  }

  getCurrentUser() {
    const url = `/users/get-current-user`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  updatePassword(password: string, oldPassword?: string) {
    const user = {
      password,
      oldPassword,
      isTempPassWord: oldPassword ? false : true,
    };
    const url = `/users/update-password`;
    return this.apiGatewayService.post(url, user).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  updateUser(user: any) {
    const userToUpdate = {
      name: user.name,
      addresses: user.addresses,
      email: user.email,
      gender: user.gender,
      birthdate: user.birthdate,
      _id: user._id,
    };
    const url = `/users/profile`;
    return this.apiGatewayService.put(url, userToUpdate).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  validateToken() {
    const url = `/auth/validate-token`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  forgotPasswordInApp(requestForgotPassword: RequestForgotPassword) {
    const url = `/auth/forgot-password-in-app`;
    return this.apiGatewayService.post(url, requestForgotPassword).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }

  resetPassword(requestResetPassword: RequestResetPassword) {
    const url = `/auth/reset-password`;
    return this.apiGatewayService.post(url, requestResetPassword).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      }),
    );
  }
}
