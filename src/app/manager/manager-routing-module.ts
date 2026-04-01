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
      { path: '', component: Dashboard },
      { path: 'profile', component: Profile },
      { path: 'requests', component: Requests },
      { path: 'outreach-workers', component: OutreachWorkers },
      { path: 'beneficiaries', loadComponent: () => import('./beneficiaries/beneficiaries').then(m => m.Beneficiaries) },
      { path: 'beneficiaries/:id', loadComponent: () => import('./beneficiaries/beneficiary-detail/beneficiary-detail').then(m => m.BeneficiaryDetail) },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManagerRoutingModule { }
