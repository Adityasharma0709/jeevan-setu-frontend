import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../core/guards/role-guard';
import { AnalystLayout } from './layout/layout';
import { AnalystDashboard } from './dashboard/dashboard';
import { AnalystBeneficiary } from './beneficiary/beneficiary';

const routes: Routes = [
  {
    path: '',
    component: AnalystLayout,
    canActivate: [roleGuard],
    data: { roles: ['ANALYST'] },
    children: [
      { path: '', component: AnalystDashboard, data: { pageTitle: 'Dashboard' } },
      { path: 'beneficiary', component: AnalystBeneficiary, data: { pageTitle: 'Beneficiary Reports' } },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnalystRoutingModule {}
