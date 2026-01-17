import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-super-layout',
  templateUrl: './layout.html',
  imports: [RouterOutlet]
})
export class Layout {

  isOpen = false;

  constructor(private router: Router) {}

  toggle() {
    this.isOpen = !this.isOpen;
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  isActive(route: string) {
    return this.router.url.includes(route);
  }
}
