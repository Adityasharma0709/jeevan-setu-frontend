import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../core/guards/role-guard';

import { DashboardComponent } from './dashboard/dashboard';
import { CreateAdminComponent } from './create-admin/create-admin';
import { ProjectsComponent } from './projects/projects';
import { ProfileComponent } from './profile/profile';
import { Layout } from './layout/layout';

const routes: Routes = [

  {
    path: '',
    component: Layout,   // 👈 Layout wrapper
    canActivate: [roleGuard],
    data: { roles: ['SUPER_ADMIN'] },

    children: [

      {
        path: '',
        component: DashboardComponent,
        data: { pageTitle: 'Dashboard' },
      },

      {
        path: 'create-admin',
        component: CreateAdminComponent,
        data: { pageTitle: 'Create Admin' },
      },

      {
        path: 'projects',
        component: ProjectsComponent,
        data: { pageTitle: 'Projects' },
      },


      {
        path: 'profile',
        component: ProfileComponent,
        data: { pageTitle: 'Profile' },
      }

    ]
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperAdminRoutingModule {}
