import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../core/guards/role-guard';

import { Layout } from './layout/layout';
import { Dashboard } from './dashboard/dashboard';
import { Managers } from './managers/managers';
import { Groups } from './groups/groups';
import { Activities } from './activities/activities';
import { Sessions } from './sessions/sessions';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';

const routes: Routes = [

  {
    path: '',
    component: Layout,   // 👈 Layout wrapper
    canActivate: [roleGuard],
    data: { roles: ['ADMIN'] },

    children: [

      // Dashboard
      {
        path: '',
        component: Dashboard
      },

      // Managers CRUD
      {
        path: 'managers',
        component: Managers
      },

      // Beneficiary Groups
      {
        path: 'groups',
        component: Groups
      },

      // Activities
      {
        path: 'activities',
        component: Activities
      },

      // Sessions
      {
        path: 'sessions',
        component: Sessions
      },

      // Manager Beneficiary Requests
      {
        path: 'requests',
        component: Requests
      },

      // Profile
      {
        path: 'profile',
        component: Profile
      }

    ]

  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
