import { Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { combineLatest, distinctUntilChanged, filter, map, startWith } from 'rxjs';

import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class TabTitleService {
  private readonly appName = 'Jeevan Setu';
  private initialized = false;

  constructor(
    private readonly router: Router,
    private readonly title: Title,
    private readonly userProfile: UserProfileService,
  ) {}

  init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const pageTitle$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.resolvePageTitle(this.router.routerState.snapshot.root)),
      distinctUntilChanged(),
    );

    combineLatest([
      pageTitle$,
      this.userProfile.displayName$.pipe(startWith('')),
    ]).subscribe(([pageTitle, userName]) => {
      this.title.setTitle(this.composeTitle(pageTitle, userName));
    });
  }

  private resolvePageTitle(route: ActivatedRouteSnapshot | null): string {
    let currentRoute = route;
    let pageTitle = '';
    let fallbackTitle = '';

    while (currentRoute) {
      const configuredPageTitle = currentRoute.data?.['pageTitle'];
      if (typeof configuredPageTitle === 'string' && configuredPageTitle.trim()) {
        pageTitle = configuredPageTitle.trim();
      }

      const humanizedPath = this.humanizePath(currentRoute.routeConfig?.path ?? '');
      if (humanizedPath) {
        fallbackTitle = humanizedPath;
      }

      currentRoute = currentRoute.firstChild ?? null;
    }

    return pageTitle || fallbackTitle || this.appName;
  }

  private composeTitle(pageTitle: string, userName: string): string {
    const parts = [pageTitle, userName.trim(), this.appName].filter(Boolean);
    return Array.from(new Set(parts)).join(' | ');
  }

  private humanizePath(path: string): string {
    const segment = path
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith(':'))
      .at(-1);

    if (!segment) {
      return '';
    }

    return segment
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }
}
