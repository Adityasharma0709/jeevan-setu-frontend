import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { roleGuard } from '../core/guards/role-guard';

import { Layout } from './layout/layout';
import { Dashboard } from './dashboard/dashboard';
import { Managers } from './managers/managers';
import { Activities } from './activities/activities';
import { Sessions } from './sessions/sessions';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';
import { AssignOutreachComponent } from './assign-outreach/assign-outreach';
import { ClusterComponent } from './cluster/cluster';
import { InstitutionsComponent } from './institutions/institutions';

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
      
      // Cluster Management
      {
        path: 'cluster',
        component: ClusterComponent,
        data: { pageTitle: 'Cluster Management' },
      },

      // Institution Management
      {
        path: 'institutions',
        component: InstitutionsComponent,
        data: { pageTitle: 'Institution Management' },
      },

      // Assign Outreach
      {
        path: 'assign-outreach',
        component: AssignOutreachComponent,
        data: { pageTitle: 'Assign Outreach' },
      }

    ]

  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
