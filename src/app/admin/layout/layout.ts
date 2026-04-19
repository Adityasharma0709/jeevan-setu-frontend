import { Component, HostListener } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardTooltipDirective } from '@/shared/components/tooltip';
import { ApiService } from '../../core/services/api';
import { ProfileVm } from '@/shared/utils/profile';
import { UserProfileService } from '../../core/services/user-profile.service';

import {
  LayoutComponent,
  SidebarComponent,
  ContentComponent,
  SidebarGroupComponent,
  SidebarGroupLabelComponent,
} from '@/shared/components/layout';
import { CommonModule } from '@angular/common';

import { ZardBadgeComponent } from '@/shared/components/badge';
import { RequestCountService } from '../../core/services/request-count.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    LayoutComponent,
    SidebarComponent,
    ContentComponent,
    ZardIconComponent,
    ZardBadgeComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    ZardTooltipDirective,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  sidebarCollapsed = window.innerWidth < 768;
  isMobile = window.innerWidth < 768;
  profile$: Observable<ProfileVm>;
  pendingCount$: Observable<number>;

  constructor(
    private router: Router,
    private api: ApiService,
    private userProfile: UserProfileService,
    private requestCountService: RequestCountService
  ) {
    this.profile$ = this.userProfile.profile$;
    this.pendingCount$ = this.requestCountService.pendingCount$;
  }

  onSidebarCollapsedChange(collapsed: boolean) {
    this.sidebarCollapsed = collapsed;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeSidebar() {
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }

  logout() {
    this.api.clearCache();
    localStorage.clear();
    this.userProfile.clearProfile();
    this.router.navigate(['/login']);
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }
}
