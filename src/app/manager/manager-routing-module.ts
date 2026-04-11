import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Dashboard } from './dashboard/dashboard';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';
import { OutreachWorkers } from './outreach-workers/outreach-workers';
import { roleGuard } from '../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [roleGuard],
    data: { roles: ['MANAGER'] },
    children: [
      { path: '', component: Dashboard, data: { pageTitle: 'Dashboard' } },
      { path: 'profile', component: Profile, data: { pageTitle: 'Profile' } },
      { path: 'requests', component: Requests, data: { pageTitle: 'Requests' } },
      { path: 'outreach-workers', component: OutreachWorkers, data: { pageTitle: 'Outreach Workers' } },
      { path: 'beneficiaries', data: { pageTitle: 'Beneficiaries' }, loadComponent: () => import('./beneficiaries/beneficiaries').then(m => m.Beneficiaries) },
      { path: 'beneficiaries/:id', data: { pageTitle: 'Beneficiary Details' }, loadComponent: () => import('./beneficiaries/beneficiary-detail/beneficiary-detail').then(m => m.BeneficiaryDetail) },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManagerRoutingModule { }
