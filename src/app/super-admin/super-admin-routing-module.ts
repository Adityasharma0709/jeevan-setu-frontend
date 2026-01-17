import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../core/guards/role-guard';

import { DashboardComponent } from './dashboard/dashboard';
import { CreateAdminComponent } from './create-admin/create-admin';
import { ProjectsComponent } from './projects/projects';
import { LocationsComponent } from './locations/locations';
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
        component: DashboardComponent
      },

      {
        path: 'create-admin',
        component: CreateAdminComponent
      },

      {
        path: 'projects',
        component: ProjectsComponent
      },

      {
        path: 'locations',
        component: LocationsComponent
      }

    ]
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperAdminRoutingModule {}
