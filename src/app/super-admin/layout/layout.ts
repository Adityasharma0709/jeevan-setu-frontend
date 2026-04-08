import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { ZardIconComponent } from '@/shared/components/icon';
import { ZardTooltipDirective } from '@/shared/components/tooltip';
import { ApiService } from '../../core/services/api';
import { ProfileVm, emptyProfile, normalizeProfile } from '@/shared/utils/profile';

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
  sidebarCollapsed = false;
  isMobile = window.innerWidth < 768;
  profile$!: Observable<ProfileVm>;

  constructor(
    private router: Router,
    private api: ApiService,
  ) {
    this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'System Admin')),
      catchError(() => of(emptyProfile('System Admin'))),
      shareReplay(1),
    );
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
