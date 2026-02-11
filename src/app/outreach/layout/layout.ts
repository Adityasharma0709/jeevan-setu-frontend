import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { ZardIconComponent } from '@/shared/components/icon';
import { ZardTooltipDirective } from '@/shared/components/tooltip';

import {
  LayoutComponent,
  SidebarComponent,
  ContentComponent,
  FooterComponent,
  SidebarGroupComponent,
  SidebarGroupLabelComponent,
} from '@/shared/components/layout';

@Component({
  selector: 'app-outreach-layout',
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
    FooterComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    ZardIconComponent,
    ZardTooltipDirective,
  ],
})
export class Layout {
  sidebarCollapsed = false;
  isMobile = window.innerWidth < 768;

  constructor(private router: Router) {}

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  closeSidebar() {
    if (this.isMobile) {
      this.sidebarCollapsed = true;
    }
  }

  logout() {
    localStorage.clear();
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
