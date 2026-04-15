import { CommonModule } from '@angular/common';
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
} from '@/shared/components/layout';

@Component({
  selector: 'app-super-layout',
  standalone: true,
  templateUrl: './layout.html',
  styleUrls: ['./layout.css'],
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    LayoutComponent,
    SidebarComponent,
    ContentComponent,
    SidebarGroupComponent,
    ZardIconComponent,
    ZardTooltipDirective,
  ],
})
export class Layout {
  sidebarCollapsed = window.innerWidth < 768;
  isMobile = window.innerWidth < 768;
  profile$: Observable<ProfileVm>;

  constructor(
    private router: Router,
    private api: ApiService,
    private userProfile: UserProfileService,
  ) {
    this.profile$ = this.userProfile.profile$;
  }

  // =========================
  // SIDEBAR CONTROLS
  // =========================

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeSidebar() {
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }

  // =========================
  // LOGOUT
  // =========================

  logout() {
    this.api.clearCache();
    localStorage.clear();
    this.userProfile.clearProfile();
    this.router.navigate(['/login']);
  }

  // =========================
  // RESPONSIVE LISTENER
  // =========================

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;

    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }
}
