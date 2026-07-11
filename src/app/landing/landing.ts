import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LandingCardComponent } from './card';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, LandingCardComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent {
  readonly backgroundCards: Array<{
    kind: 'image' | 'empty';
    bgImage?: string;
  }> = [
    { kind: 'empty' },
    { kind: 'image', bgImage: 'medical-consultation.png' },
    { kind: 'empty' },
    { kind: 'image', bgImage: 'illustration-of-medical.jpg' },
    { kind: 'image', bgImage: 'community-health.png' },
    { kind: 'empty' },
    { kind: 'empty' },
    { kind: 'image', bgImage: 'digital-healthcare.png' },
    { kind: 'empty' },
    { kind: 'image', bgImage: 'health-wellness.png' },
    { kind: 'empty' },
    { kind: 'empty' },
  ];
  constructor(private readonly router: Router) {}

  trackByIndex(index: number) {
    return index;
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

}
