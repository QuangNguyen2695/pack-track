import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class NoAuthGuard implements CanActivate {
    constructor(private credentialService: CredentialService, private router: Router) { }

    async canActivate(): Promise<boolean> {
        const token = await this.credentialService.getToken();
        const user = await this.credentialService.getCurrentUser();
        if (!token || !user) {
            return Promise.resolve(true);
        } else {
            this.router.navigate(['/tabs/home']);
            return Promise.resolve(false);
        }
    }
}
