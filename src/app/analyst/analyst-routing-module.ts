import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { roleGuard } from '../core/guards/role-guard';
import { AnalystLayout } from './layout/layout';
import { AnalystDashboard } from './dashboard/dashboard';

const routes: Routes = [
  {
    path: '',
    component: AnalystLayout,
    canActivate: [roleGuard],
    data: { roles: ['ANALYST'] },
    children: [
      { path: '', component: AnalystDashboard, data: { pageTitle: 'Dashboard' } },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AnalystRoutingModule {}
