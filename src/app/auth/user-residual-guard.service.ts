import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { CredentialService } from '@rsApp/shared/services/credential-service/credential.service';

@Injectable({
    providedIn: 'root',
})
export class UserResidualGuard implements CanActivate {
    constructor(private credentialService: CredentialService,
        private router: Router,
    ) { }

    canActivate(): Observable<boolean> | Promise<boolean> | boolean {
        return this.credentialService.getUserResidual().then(userResidual => {
            if (!userResidual) {
                return true;
            } else {
                this.router.navigate(['/auth-access/verify-password']);
                return false;
            }
        });
    }
}
