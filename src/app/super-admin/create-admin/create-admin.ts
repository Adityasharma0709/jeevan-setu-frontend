import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api';
import { Observable } from 'rxjs';

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
import { toast } from 'ngx-sonner';


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
  admins$!: Observable<any>;

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

    this.admins$ = this.api.get('users/admins');
  }

openCreateDialog() {
  this.dialogRef = this.dialog.create({
    zTitle: 'Create Admin',
    zContent: this.createAdminDialog,
    zOkText: 'Create',
    zCancelText: 'Cancel',
    zWidth: '400px',

    zOnOk: () => {
      this.submit();
      return false; // prevent auto close
    },

    zOnCancel: () => {
      this.form.reset();
    }
  });
}



submit() {
  this.api.post('users/create-admin', this.form.value)
    .subscribe({
      next: () => {
        toast.success('Admin created successfully');

        this.form.reset();
        this.admins$ = this.api.get('users/admins');
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

        this.admins$ = this.api.get('users/admins');
      },
      error: () => toast.error('Failed to update status')
    });
}

}
