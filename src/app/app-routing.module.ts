import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './auth/auth-guard.service';
import { NoAuthGuard } from './auth/no-auth.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./modules/layouts/layout.module').then((m) => m.LayoutModule),
    // canActivate: [AuthGuard],
  },
  {
    path: 'auth-access',
    loadChildren: () =>
      import('./modules/auth-access/auth-access.module').then(
        (m) => m.AuthAccessPageModule
      ),
    // canActivate: [NoAuthGuard],
  },
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
