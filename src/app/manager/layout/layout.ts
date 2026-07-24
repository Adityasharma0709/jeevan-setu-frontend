import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, Observable, startWith } from 'rxjs';

import { ZardIconComponent, type ZardIcon } from '@/shared/components/icon';
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

import { ZardBadgeComponent } from '@/shared/components/badge';
import { RequestCountService } from '../../core/services/request-count.service';

@Component({
  selector: 'app-manager-layout',
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
    ZardBadgeComponent,
    ZardTooltipDirective,
  ],
})
export class Layout implements OnInit {
  private readonly titleContext = {
    Dashboard: 'Overview of your manager workspace',
    Profile: 'Update your account information',
    Requests: 'Review submitted outreach requests',
    'Outreach Workers': 'Manage and track outreach workers',
    Beneficiaries: 'Track and view all project beneficiaries',
    'Beneficiary Details': 'Review detailed beneficiary information',
  } as const;

  readonly navItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
    hasBadge?: boolean;
  }[] = [
    { path: '/manager', label: 'Dashboard', icon: 'house', activePaths: ['/manager'], exact: true },
    { path: '/manager/requests', label: 'Requests', icon: 'inbox', activePaths: ['/manager/requests'], hasBadge: true },
    { path: '/manager/outreach-workers', label: 'Outreach Workers', icon: 'users', activePaths: ['/manager/outreach-workers'] },
    { path: '/manager/beneficiaries', label: 'Beneficiaries', icon: 'users', activePaths: ['/manager/beneficiaries'] },
  ];

  readonly mobileNavItems: readonly {
    path: string;
    label: string;
    icon: ZardIcon;
    activePaths: readonly string[];
    exact?: boolean;
  }[] = [
    { path: '/manager', label: 'Home', icon: 'house', activePaths: ['/manager'], exact: true },
    { path: '/manager/requests', label: 'Requests', icon: 'inbox', activePaths: ['/manager/requests'] },
    { path: '/manager/outreach-workers', label: 'Workers', icon: 'users', activePaths: ['/manager/outreach-workers'] },
    { path: '/manager/beneficiaries', label: 'Beneficiaries', icon: 'users', activePaths: ['/manager/beneficiaries'] },
  ];

  sidebarCollapsed = window.innerWidth < 768;
  isMobile = window.innerWidth < 768;
  profile$: Observable<ProfileVm>;
  pendingCount$: Observable<number>;
  pageContext$: Observable<{ title: string; subtitle: string; showBack: boolean; backTarget: string }>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private userProfile: UserProfileService,
    private requestCountService: RequestCountService,
  ) {
    this.profile$ = this.userProfile.profile$;
    this.pendingCount$ = this.requestCountService.pendingCount$;
    this.pageContext$ = this.router.events.pipe(
      startWith(null),
      filter((event): event is NavigationEnd | null => event === null || event instanceof NavigationEnd),
      map(() => this.resolvePageContext()),
    );
  }

  ngOnInit() {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
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
    const title = String(activeRoute.snapshot.data?.['pageTitle'] || 'Manager').trim();
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
    return this.titleContext[title as keyof typeof this.titleContext] || 'Manager workspace';
  }

  private resolveBackTarget(path: string): string {
    if (path.startsWith('/manager/beneficiaries/')) {
      return '/manager/beneficiaries';
    }
    return '/manager';
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }
}
