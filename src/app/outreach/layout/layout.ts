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
  selector: 'app-outreach-layout',
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
export class Layout {
  private readonly titleContext = {
    Dashboard: 'Overview of your outreach workspace',
    Beneficiaries: 'Manage and track assigned beneficiaries',
    'Create Beneficiary': 'Register a new beneficiary record',
    'Beneficiary Profile': 'Review details, family, and history',
    'Request Update': 'Submit changes for manager approval',
    Requests: 'Review the status of submitted requests',
    Activity: 'Track and submit outreach activity reports',
    'Report Activity': 'Create a new activity report',
    Profile: 'Update your account information',
  } as const;

  readonly navItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
  }[] = [
    { path: '/outreach', label: 'Dashboard', icon: 'house', activePaths: ['/outreach'], exact: true },
    { path: '/outreach/requests', label: 'My Requests', icon: 'inbox', activePaths: ['/outreach/requests'] },
    {
      path: '/outreach/beneficiaries',
      label: 'Beneficiaries',
      icon: 'users',
      activePaths: ['/outreach/beneficiaries', '/outreach/beneficiary'],
    },
    {
      path: '/outreach/activity',
      label: 'Reports',
      icon: 'file-text',
      activePaths: ['/outreach/activity', '/outreach/report-activity'],
    },
  ];

  readonly mobileNavItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
  }[] = [
    { path: '/outreach', label: 'Home', icon: 'house', activePaths: ['/outreach'], exact: true },
    {
      path: '/outreach/beneficiaries',
      label: 'Beneficiaries',
      icon: 'users',
      activePaths: ['/outreach/beneficiaries', '/outreach/beneficiary'],
    },
    {
      path: '/outreach/activity',
      label: 'Reports',
      icon: 'file-text',
      activePaths: ['/outreach/activity', '/outreach/report-activity'],
    },
    { path: '/outreach/requests', label: 'Requests', icon: 'inbox', activePaths: ['/outreach/requests'] },
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
    const title = String(activeRoute.snapshot.data?.['pageTitle'] || 'Outreach').trim();
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
    return this.titleContext[title as keyof typeof this.titleContext] || 'Outreach workspace';
  }

  private resolveBackTarget(path: string): string {
    if (path.startsWith('/outreach/beneficiary/') && path.endsWith('/request-update')) {
      const id = path.split('/')[3];
      return `/outreach/beneficiary/${id}`;
    }

    if (path.startsWith('/outreach/beneficiary/')) {
      return '/outreach/beneficiaries';
    }

    if (path === '/outreach/beneficiaries/create') {
      return '/outreach/beneficiaries';
    }

    if (path === '/outreach/report-activity') {
      return '/outreach/activity';
    }

    if (path === '/outreach/activity') {
      return '/outreach';
    }

    if (path === '/outreach/requests') {
      return '/outreach';
    }

    if (path === '/outreach/profile') {
      return '/outreach';
    }

    return '/outreach';
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }
}
