import { Injectable } from '@angular/core';
import { from, of } from 'rxjs';
import {
  catchError,
  delay,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ApiGatewayService } from 'src/app/api-gateway/api-gateaway.service';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';

@Injectable({
  providedIn: 'root',
})
export class AuthAccessService {
  constructor(
    private apiGatewayService: ApiGatewayService,
    private credentialService: CredentialService
  ) {}

  verifyPhoneNumber(phoneNumber: string) {
    const url = `/auth/verify-phoneNumber?phoneNumber=${phoneNumber}`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {
        console.log('🚀 ~ AuthAccessService ~ map ~ res:', res);
      }),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        console.log('🚀 ~ AuthAccessService ~ catchError ~ error:', error);
        //write log
        return of([]);
      })
    );
  }

  sendOtp(phoneNumber: string) {
    const url = `/auth/verify-phoneNumber?phoneNumber=${phoneNumber}`;
    return this.apiGatewayService.get(url).pipe(
      tap((res: any) => {}),
      map((res: any) => {
        return res;
      }),
      catchError((error) => {
        //write log
        return of([]);
      })
    );
  }

  login(phoneNumber: string, password: string) {
    const user = {
      phoneNumber,
      password,
    };
    const url = `/auth/login?phoneNumber=${phoneNumber}`;
    return this.apiGatewayService.post(url, user).pipe(
      switchMap((res: any) => {
        if (res) {
          return from(this.credentialService.setToken(res.access_token)).pipe(
            switchMap(() => this.getCurrentUser()),
            switchMap((user: any) => {
              if (user) {
                return from(this.credentialService.setCurrentUser(user)).pipe(
                  map(() => user)
                );
              }
              return of(null);
            })
          );
        }
        return of(null);
      }),
      catchError((error) => {
        //write log
        return of(error.error);
      })
    );
  }

  verifyOtp(phoneNumber: string, otp: string) {}

  register(phoneNumber: string, name: string) {
    const url = `/users/register`;
    const user = {
      phoneNumber,
      name,
      password: 'password123',
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
      })
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
      })
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
      })
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
      })
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
      })
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
      })
    );
  }
}
