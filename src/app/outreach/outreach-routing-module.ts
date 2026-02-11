import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Dashboard } from './dashboard/dashboard';
import { Profile } from './profile/profile';
import { Beneficiaries } from './beneficiaries/beneficiaries';
import { Activity } from './activity/activity';
import { roleGuard } from '../core/guards/role-guard';

const routes: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [roleGuard],
    data: { roles: ['OUTREACH'] },
    children: [
      { path: '', component: Dashboard },
      { path: 'profile', component: Profile },
      { path: 'beneficiaries', component: Beneficiaries },
      { path: 'activity', component: Activity },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OutreachRoutingModule {}
