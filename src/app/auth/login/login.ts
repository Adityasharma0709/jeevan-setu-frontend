import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
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
    private cdr: ChangeDetectorRef,
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

    this.api.post('auth/login', this.form.value).pipe(
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
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
      error: (err) => {
        const message = this.getErrorMessage(err, 'Invalid email or password');
        setTimeout(() => {
          this.errorMessage = message;
          this.cdr.markForCheck();
          toast.error(message);
        }, 0);
      }
    });
  }

  private getErrorMessage(err: any, fallback: string): string {
    const status = Number(err?.status);
    const rawMessage = err?.message ?? err?.error?.message;
    const textMessage = typeof rawMessage === 'string' ? rawMessage : '';

    if (status === 0 || /ECONNREFUSED|ERR_CONNECTION_REFUSED|Failed to fetch/i.test(textMessage)) {
      return 'Unable to reach server. Please check your connection.';
    }
    if (status === 401) return 'Unauthorized. Please sign in again.';
    if (status === 403) return 'Access denied.';
    if (status === 404) return 'Requested resource not found.';
    if (status >= 500) return 'Server error. Please try again later.';

    const message = err?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') return JSON.stringify(message);
    return fallback;
  }
}
