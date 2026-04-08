import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
SidebarGroupLabelComponent,
} from '@/shared/components/layout';

@Component({
selector: 'app-manager-layout',
standalone: true,
templateUrl: './layout.html',
styleUrls: ['./layout.css'],
imports: [
CommonModule,
RouterOutlet,
RouterLink,
RouterLinkActive,
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
sidebarCollapsed = false;
isMobile = window.innerWidth < 768;
profile$!: Observable<ProfileVm>;

constructor(private router: Router, private api: ApiService) {}

ngOnInit() {
this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
map((raw) => normalizeProfile(raw, 'Manager')),
catchError(() => of(emptyProfile('Manager'))),
shareReplay(1),
);
}

toggleSidebar() {
this.sidebarCollapsed = !this.sidebarCollapsed;
}

logout() {
this.api.clearCache();
localStorage.clear();
this.router.navigate(['/login']);
}

closeSidebar() {
if (this.isMobile) this.sidebarCollapsed = true;
}

@HostListener('window:resize')
onResize() {
this.isMobile = window.innerWidth < 768;
if (this.isMobile) this.sidebarCollapsed = true;
}
}
