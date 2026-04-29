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
import { CreateAwcComponent } from './create-awc/create-awc';

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
        component: Dashboard,
        data: { pageTitle: 'Dashboard' },
      },

      // Managers CRUD
      {
        path: 'managers',
        component: Managers,
        data: { pageTitle: 'Managers' },
      },

      // Beneficiary Groups
      {
        path: 'groups',
        component: Groups,
        data: { pageTitle: 'Groups' },
      },

      // Activities
      {
        path: 'activities',
        component: Activities,
        data: { pageTitle: 'Activities' },
      },

      // Sessions
      {
        path: 'sessions',
        component: Sessions,
        data: { pageTitle: 'Sessions' },
      },

      // Manager Beneficiary Requests
      {
        path: 'requests',
        component: Requests,
        data: { pageTitle: 'Requests' },
      },

      // Profile
      {
        path: 'profile',
        component: Profile,
        data: { pageTitle: 'Profile' },
      },
      
      // AWC Management
      {
        path: 'awcs',
        component: CreateAwcComponent,
        data: { pageTitle: 'AWC Management' },
      }

    ]

  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
