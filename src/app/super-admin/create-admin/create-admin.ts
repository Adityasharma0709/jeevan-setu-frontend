import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { Observable } from 'rxjs';
import {
  ZardFormFieldComponent,
  ZardFormControlComponent,
  ZardFormLabelComponent,
  ZardFormMessageComponent
}from '@/shared/components/form';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import {  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableCaptionComponent } from '@/shared/components/table';
@Component({
  selector: 'app-create-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,  ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardFormLabelComponent,
    ZardFormMessageComponent,
    ZardButtonComponent,
    ZardInputDirective,
     // Zard Table
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableCaptionComponent
  ],
  templateUrl: './create-admin.html'
})
export class CreateAdminComponent {

  form!: FormGroup;
  admins$!: Observable<any>;

  errorMsg = '';
  successMsg = '';

  constructor(
    private fb: FormBuilder,
    private api: ApiService
  ) {

    this.form = this.fb.group({
      name: [''],
      email: [''],
      password: ['']
    });

    // Auto fetch
    this.admins$ = this.api.get('users/admins');
  }

  submit() {

    this.errorMsg = '';
    this.successMsg = '';

    this.api.post('users/create-admin', this.form.value)
      .subscribe({

        next: () => {
          this.successMsg = 'Admin created successfully ✅';
          this.form.reset();

          // refresh list
          this.admins$ = this.api.get('users/admins');
        },

        error: (err) => {

          console.log(err);

          // Backend message
          if (err.status === 400) {
            this.errorMsg = err.error?.message || 'Bad Request';
          }

          // Duplicate email
          else if (err.status === 409) {
            this.errorMsg = 'Email already exists ❌';
          }

          // Unauthorized
          else if (err.status === 401) {
            this.errorMsg = 'Session expired. Login again';
          }

          // Server error
          else if (err.status === 500) {
            this.errorMsg = 'Server error. Try later';
          }

          // Network
          else {
            this.errorMsg = 'Something went wrong';
          }
        }

      });
  }
}
