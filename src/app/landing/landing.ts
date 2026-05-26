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
  constructor(private readonly router: Router) {}

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
