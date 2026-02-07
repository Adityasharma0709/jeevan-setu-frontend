import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { toast } from 'ngx-sonner';

import {
  ZardFormFieldComponent,
  ZardFormControlComponent,
  ZardFormLabelComponent,
  ZardFormMessageComponent
} from '@/shared/components/form';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';

import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableCaptionComponent
} from '@/shared/components/table';

import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';

@Component({
  selector: 'app-create-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardFormLabelComponent,
    ZardFormMessageComponent,
    ZardButtonComponent,
    ZardInputDirective,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardTableCaptionComponent,
    ZardDialogModule,
  ],
  templateUrl: './create-admin.html'
})
export class CreateAdminComponent {

  @ViewChild('createAdminDialog')
  createAdminDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  form!: FormGroup;

  // ✅ refresh trigger stream
  private refresh$ = new Subject<void>();

  // ✅ stable observable stream
  admins$: Observable<any> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins'))
  );

  errorMsg = '';
  successMsg = '';

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService,
  ) {
    this.form = this.fb.group({
      name: [''],
      email: [''],
      password: ['']
    });
  }

  // ======================
  // CREATE DIALOG
  // ======================

  openCreateDialog() {
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Admin',
      zContent: this.createAdminDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => {
        this.form.reset();
      }
    });
  }

  // ======================
  // CREATE ADMIN
  // ======================

  submit() {
    this.api.post('users/create-admin', this.form.value)
      .subscribe({
        next: () => {
          toast.success('Admin created successfully');

          this.form.reset();

          // ✅ safe refresh
          this.refresh$.next();

          this.dialogRef?.close();
        },
        error: (err) => {
          let msg = 'Something went wrong';

          if (err.status === 400) msg = err.error?.message || 'Bad Request';
          else if (err.status === 409) msg = 'Email already exists';
          else if (err.status === 401) msg = 'Session expired. Login again';
          else if (err.status === 500) msg = 'Server error. Try later';

          toast.error(msg);
        }
      });
  }

  // ======================
  // TOGGLE STATUS
  // ======================

  toggleAdminStatus(admin: any) {
    const status =
      admin.status === 'ACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    this.api.patch(`users/admin/${admin.id}/status`, { status })
      .subscribe({
        next: () => {
          toast.success(
            status === 'ACTIVE'
              ? 'Admin activated'
              : 'Admin deactivated'
          );

          // ✅ safe refresh
          this.refresh$.next();
        },
        error: () => toast.error('Failed to update status')
      });
  }
}
