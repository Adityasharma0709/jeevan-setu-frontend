import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    data: { pageTitle: 'Login' },
  },

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

  {
    path: 'manager',
    loadChildren: () =>
      import('./manager/manager-module').then(
        (m) => m.ManagerModule
      ),
  },

  {
    path: 'outreach',
    loadChildren: () =>
      import('./outreach/outreach-module').then(
        (m) => m.OutreachModule
      ),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

