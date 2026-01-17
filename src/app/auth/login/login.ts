import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html'
})
export class LoginComponent {

  form;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

submit() {

  this.api.post('auth/login', this.form.value)
    .subscribe((res: any) => {

      // save token
      localStorage.setItem('token', res.accessToken);

      const roles: string[] = res.user.roles;

      if (roles.includes('SUPER_ADMIN')) {
        this.router.navigate(['/super-admin']);
      }
      else if (roles.includes('ADMIN')) {
        this.router.navigate(['/admin']);
      }
      else if (roles.includes('MANAGER')) {
        this.router.navigate(['/manager']);
      }

    });
}

}
