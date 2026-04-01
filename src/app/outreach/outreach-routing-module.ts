import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../core/guards/role-guard';

import { Activity } from './activity/activity';
import { Beneficiaries } from './beneficiaries/beneficiaries';
import { Dashboard } from './dashboard/dashboard';
import { Layout } from './layout/layout';
import { Profile } from './profile/profile';
import { ReportActivity } from './report-activity/report-activity';

const routes: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [roleGuard],
    data: { roles: ['OUTREACH'] },
    children: [
      { path: '', component: Dashboard },
      { path: 'beneficiaries', component: Beneficiaries },
      { path: 'beneficiaries/create', loadComponent: () => import('./create-beneficiary/create-beneficiary').then(m => m.CreateBeneficiary) },
      { path: 'beneficiary/:id', loadComponent: () => import('./profile-view/profile-view').then(m => m.ProfileView) },
      { path: 'beneficiary/:id/request-update', loadComponent: () => import('./request-update/request-update').then(m => m.RequestUpdate) },
      { path: 'requests', loadComponent: () => import('./requests/requests').then(m => m.Requests) },
      { path: 'activity', component: Activity },
      { path: 'report-activity', component: ReportActivity },
      { path: 'profile', component: Profile },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OutreachRoutingModule { }
