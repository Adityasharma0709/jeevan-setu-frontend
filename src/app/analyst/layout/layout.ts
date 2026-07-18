import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, Observable, startWith } from 'rxjs';

import { ZardIconComponent, type ZardIcon } from '@/shared/components/icon';
import {
  ContentComponent,
  LayoutComponent,
  SidebarComponent,
  SidebarGroupComponent,
  SidebarGroupLabelComponent,
} from '@/shared/components/layout';
import { ZardTooltipDirective } from '@/shared/components/tooltip';
import { ApiService } from '../../core/services/api';
import { ProfileVm } from '@/shared/utils/profile';
import { UserProfileService } from '../../core/services/user-profile.service';

@Component({
  selector: 'app-analyst-layout',
  standalone: true,
  templateUrl: './layout.html',
  styleUrls: ['./layout.css'],
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    LayoutComponent,
    SidebarComponent,
    ContentComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    ZardIconComponent,
    ZardTooltipDirective,
  ],
})
export class AnalystLayout {
  private readonly titleContext = {
    Dashboard: 'Overview of your analyst workspace',
    'Beneficiary Reports': 'All beneficiary reporting data across your assigned projects',
    Profile: 'Update your account information',
  } as const;

  readonly navItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
  }[] = [
    { path: '/analyst', label: 'Dashboard', icon: 'house', activePaths: ['/analyst'], exact: true },
    {
      path: '/analyst/beneficiary',
      label: 'Beneficiary',
      icon: 'users',
      activePaths: ['/analyst/beneficiary'],
    },
  ];

  readonly mobileNavItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
  }[] = [
    { path: '/analyst', label: 'Home', icon: 'house', activePaths: ['/analyst'], exact: true },
    {
      path: '/analyst/beneficiary',
      label: 'Beneficiary',
      icon: 'users',
      activePaths: ['/analyst/beneficiary'],
    },
  ];

  sidebarCollapsed = window.innerWidth < 768;
  isMobile = window.innerWidth < 768;
  profile$: Observable<ProfileVm>;
  pageContext$: Observable<{ title: string; subtitle: string; showBack: boolean; backTarget: string }>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private userProfile: UserProfileService,
  ) {
    this.profile$ = this.userProfile.profile$;
    this.pageContext$ = this.router.events.pipe(
      startWith(null),
      filter((event): event is NavigationEnd | null => event === null || event instanceof NavigationEnd),
      map(() => this.resolvePageContext()),
    );
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeSidebar() {
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }

  goBack(target: string): void {
    this.router.navigateByUrl(target);
  }

  isActiveRoute(prefixes: readonly string[], exact = false): boolean {
    const currentUrl = this.router.url.split('?')[0];
    return prefixes.some(prefix => exact ? currentUrl === prefix : currentUrl === prefix || currentUrl.startsWith(`${prefix}/`));
  }

  logout() {
    this.api.clearCache();
    localStorage.clear();
    this.userProfile.clearProfile();
    this.router.navigate(['/login']);
  }

  trackByPath(_: number, item: { path: string }): string {
    return item.path;
  }

  private resolvePageContext(): { title: string; subtitle: string; showBack: boolean; backTarget: string } {
    const activeRoute = this.resolveActiveRoute(this.route);
    const title = String(activeRoute.snapshot.data?.['pageTitle'] || 'Analyst').trim();
    return {
      title,
      subtitle: this.getPageSubtitle(title),
      showBack: title !== 'Dashboard',
      backTarget: this.resolveBackTarget(this.router.url.split('?')[0]),
    };
  }

  private resolveActiveRoute(route: ActivatedRoute): ActivatedRoute {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private getPageSubtitle(title: string): string {
    return this.titleContext[title as keyof typeof this.titleContext] || 'Analyst workspace';
  }

  private resolveBackTarget(path: string): string {
    if (path === '/analyst/beneficiary') {
      return '/analyst';
    }
    if (path === '/analyst/profile') {
      return '/analyst';
    }
    return '/analyst';
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }
}
