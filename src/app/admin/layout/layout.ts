import { Component, HostListener } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
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
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    LayoutComponent,
    SidebarComponent,
    ContentComponent,
    FooterComponent,
    ZardIconComponent,
    SidebarGroupComponent,
    SidebarGroupLabelComponent,
    ZardTooltipDirective,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})

export class Layout {

  sidebarCollapsed = false;
  isMobile = false;

  constructor(private router: Router) {}

  ngOnInit() {
    this.isMobile = window.innerWidth < 768;
    this.sidebarCollapsed = this.isMobile;
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
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  @HostListener('window:resize')
  onResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;

    if (this.isMobile !== wasMobile) {
      this.sidebarCollapsed = this.isMobile;
    }
  }
}

