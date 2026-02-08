import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  {
    path: 'super-admin',
    loadChildren: () =>
      import('./super-admin/super-admin-module').then(
        (m) => m.SuperAdminModule
      ),
  },

  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin-module').then(
        (m) => m.AdminModule
      ),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
