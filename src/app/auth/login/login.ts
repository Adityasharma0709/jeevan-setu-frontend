import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  form;
  showPassword = false;
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  submit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.api.post('auth/login', this.form.value).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.accessToken);

        const roles: string[] = res.user.roles;

        if (roles.includes('SUPER_ADMIN')) {
          this.router.navigate(['/super-admin']);
        } else if (roles.includes('ADMIN')) {
          this.router.navigate(['/admin']);
        } else if (roles.includes('MANAGER')) {
          this.router.navigate(['/manager']);
        } else if (roles.includes('OUTREACH')) {
          this.router.navigate(['/outreach']);
        }
      },
      error: () => {
        this.errorMessage = 'Invalid email or password';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }
}
