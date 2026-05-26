import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LandingCardComponent } from './card';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, LandingCardComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent {
  readonly backgroundCards: Array<{
    kind: 'image' | 'sphere' | 'circle' | 'leaf' | 'network' | 'empty';
    bgImage?: string;
  }> = [
    { kind: 'empty' },
    { kind: 'circle' },
    { kind: 'empty' },
    { kind: 'image', bgImage: 'illustration-of-medical.jpg' },
    { kind: 'sphere' },
    { kind: 'empty' },
    { kind: 'empty' },
    { kind: 'leaf' },
    { kind: 'empty' },
    { kind: 'network' },
    { kind: 'empty' },
    { kind: 'empty' },
  ];
// readonly backgroundCards = [
//   { kind: 'image', bgImage: 'img-1.jpg' },
//   { kind: 'image', bgImage: 'img-2.jpg' },
//   { kind: 'image', bgImage: 'img-3.jpg' },
//   // ...
// ];
  constructor(private readonly router: Router) {}

  trackByIndex(index: number) {
    return index;
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  createAccount() {
    toast.info('Account registration is managed by administrators.', {
      description: 'Please contact your project supervisor to register a new account.',
      duration: 5000,
    });
  }
}
