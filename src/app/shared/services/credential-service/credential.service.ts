import { Injectable } from '@angular/core';
import { CookieService } from '../cookie-service/cookie.service';

@Injectable({
  providedIn: 'root',
})
export class CredentialService {
  private expires: number = 7; // Thời gian hết hạn cookie (tính bằng ngày)
  constructor(private cookieService: CookieService) {}

  async setToken(token: string) {
    await this.cookieService.set('token', token, this.expires); // Sử dụng biến expires
  }

  async getToken(): Promise<string | null> {
    return await this.cookieService.get('token');
  }

  async removeToken(): Promise<void> {
    await this.cookieService.remove('token');
  }

  async setCurrentUser(user: any) {
    await this.cookieService.set('user', user, this.expires); // Sử dụng biến expires
  }

  async getCurrentUser() {
    return await this.cookieService.get('user');
  }

  async removeCurrentUser() {
    await this.cookieService.remove('user');
  }

  async setUserResidual(user: any) {
    await this.cookieService.set('userResidual', user, this.expires); // Sử dụng biến expires
  }

  async getUserResidual() {
    return await this.cookieService.get('userResidual');
  }

  async removeUserResidual() {
    await this.cookieService.remove('userResidual');
  }
}
