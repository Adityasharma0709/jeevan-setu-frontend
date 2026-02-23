import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../core/guards/role-guard';

import { Activity } from './activity/activity';
import { Beneficiaries } from './beneficiaries/beneficiaries';
import { Dashboard } from './dashboard/dashboard';
import { Layout } from './layout/layout';
import { Profile } from './profile/profile';

const routes: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [roleGuard],
    data: { roles: ['OUTREACH'] },
    children: [
      { path: '', component: Dashboard },
      { path: 'beneficiaries', component: Beneficiaries },
      { path: 'search', loadComponent: () => import('./search/search').then(m => m.Search) },
      { path: 'beneficiary/:id', loadComponent: () => import('./profile-view/profile-view').then(m => m.ProfileView) },
      { path: 'requests', loadComponent: () => import('./requests/requests').then(m => m.Requests) },
      { path: 'activity', component: Activity },
      { path: 'profile', component: Profile },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OutreachRoutingModule { }
