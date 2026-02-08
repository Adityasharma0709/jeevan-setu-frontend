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
  ZardFormMessageComponent,
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
  ZardTableCaptionComponent,
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
  templateUrl: './create-admin.html',
})
export class CreateAdminComponent {
  /* ======================
     TEMPLATE REFERENCES
  ====================== */

  @ViewChild('createAdminDialog')
  createAdminDialog!: TemplateRef<any>;

  @ViewChild('editAdminDialog')
  editAdminDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  /* ======================
     FORMS
  ====================== */

  form: FormGroup;
  editForm: FormGroup;

  /* ======================
     REFRESH STREAM
  ====================== */

  private refresh$ = new Subject<void>();

  admins$: Observable<any> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins')),
  );

  /* ======================
     CONSTRUCTOR
  ====================== */

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService,
  ) {
    // Create form
    this.form = this.fb.group({
      name: [''],
      email: [''],
      password: [''],
    });

    // Edit form
    this.editForm = this.fb.group({
      name: [''],
      email: [''],
    });
  }

  /* ======================
     CREATE DIALOG
  ====================== */

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

      zOnCancel: () => this.form.reset(),
    });
  }

  /* ======================
     CREATE ADMIN
  ====================== */

  submit() {
    this.api.post('users/create-admin', this.form.value).subscribe({
      next: () => {
        toast.success('Admin created successfully');

        this.form.reset();
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
      },
    });
  }

  /* ======================
     EDIT ADMIN
  ====================== */

  openEditDialog(admin: any) {
    this.editForm.patchValue({
      name: admin.name,
      email: admin.email,
    });

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Admin',
      zContent: this.editAdminDialog,
      zOkText: 'Update',

      zOnOk: () => {
        this.updateAdmin(admin.id);
        return false;
      },
    });
  }

  updateAdmin(id: number) {
    // ✅ clean payload (prevents 400 error)
    const payload = {
      name: this.editForm.value.name,
      email: this.editForm.value.email,
    };

    this.api.put(`users/admin/${id}`, payload).subscribe({
      next: () => {
        toast.success('Admin updated');
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: () => toast.error('Update failed'),
    });
  }

  /* ======================
     TOGGLE STATUS
  ====================== */

  toggleAdminStatus(admin: any) {
    const status = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.api.patch(`users/admin/${admin.id}/status`, { status }).subscribe({
      next: () => {
        toast.success(
          status === 'ACTIVE'
            ? 'Admin activated'
            : 'Admin deactivated',
        );

        this.refresh$.next();
      },
      error: () => toast.error('Failed to update status'),
    });
  }
}
