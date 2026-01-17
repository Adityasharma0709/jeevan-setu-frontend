import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login';
export const routes: Routes = [  { path:'login', component: LoginComponent },

  {
    path:'super-admin',
    loadChildren: () =>
      import('./super-admin/super-admin-module')
      .then(m => m.SuperAdminModule)
  },

  { path:'', redirectTo:'login', pathMatch:'full' }
];

