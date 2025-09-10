import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';

@Injectable({
    providedIn: 'root',
})
export class AuthGuard implements CanActivate {
    constructor(private credentialService: CredentialService, private router: Router) { }

    async canActivate(): Promise<boolean> {
        const token = await this.credentialService.getToken();
        const user = await this.credentialService.getCurrentUser();
        if (token && user) {
            return Promise.resolve(true);
        } else {
            this.router.navigate(['/auth-access']);
            return Promise.resolve(false);
        }
    }
}
