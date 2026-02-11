import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Layout } from './layout/layout';
import { Dashboard } from './dashboard/dashboard';
import { Profile } from './profile/profile';
import { Requests } from './requests/requests';
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
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManagerRoutingModule {}
