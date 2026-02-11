import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { AdminService, Activity } from '../admin.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';

@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardDialogModule,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardIconComponent,
  ],
  templateUrl: './activities.html',
  styleUrl: './activities.css',
})
export class Activities {
  @ViewChild('activityDialog') activityDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  activityForm!: FormGroup;

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedActivityId: number | null = null;

  activities$!: Observable<Activity[]>;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private dialog: ZardDialogService
  ) {
    this.activities$ = this.refresh$.pipe(
      startWith(void 0),
      switchMap(() => this.adminService.getActivities())
    );
    this.initForm();
  }

  private initForm() {
    this.activityForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
    });
  }

  openCreateDialog() {
    this.isEditing = false;
    this.activityForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Activity',
      zContent: this.activityDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitActivity();
        return false;
      },
    });
  }

  openEditDialog(activity: Activity) {
    this.isEditing = true;
    this.selectedActivityId = activity.id;
    this.activityForm.patchValue(activity);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Activity',
      zContent: this.activityDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitActivity();
        return false;
      },
    });
  }

  submitActivity() {
    if (this.activityForm.invalid) {
      toast.error('Please fill all required fields');
      return;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateActivity(this.selectedActivityId!, this.activityForm.value)
      : this.adminService.createActivity(this.activityForm.value);

    obs.subscribe({
      next: () => {
        toast.success(`Activity ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err.error?.message || 'Something went wrong');
        this.isSubmitting = false;
      }
    });
  }

  deactivateActivity(id: number) {
    if (!confirm('Are you sure you want to deactivate this activity?')) return;

    this.adminService.deactivateActivity(id).subscribe({
      next: () => {
        toast.success('Activity deactivated');
        this.refresh$.next();
      },
      error: (err) => toast.error(err.error?.message || 'Failed to deactivate')
    });
  }
}
