import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { AdminService, Group, Activity } from '../admin.service';
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
  selector: 'app-groups',
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
  templateUrl: './groups.html',
  styleUrl: './groups.css',
})
export class Groups {
  @ViewChild('groupDialog') groupDialog!: TemplateRef<any>;
  @ViewChild('tagDialog') tagDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  groupForm!: FormGroup;
  tagForm!: FormGroup;

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedGroupId: number | null = null;
  targetGroup: Group | null = null;

  groups$!: Observable<Group[]>;
  activities$!: Observable<Activity[]>;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private dialog: ZardDialogService
  ) {
    this.groups$ = this.refresh$.pipe(
      startWith(void 0),
      switchMap(() => this.adminService.getGroups())
    );

    this.activities$ = this.adminService.getActivities();
    this.initForms();
  }

  private initForms() {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      minAge: [null],
      maxAge: [null],
    });

    this.tagForm = this.fb.group({
      activityId: ['', Validators.required],
    });
  }

  openCreateDialog() {
    this.isEditing = false;
    this.groupForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Beneficiary Group',
      zContent: this.groupDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitGroup();
        return false;
      },
    });
  }

  openEditDialog(group: Group) {
    this.isEditing = true;
    this.selectedGroupId = group.id;
    this.groupForm.patchValue(group);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Group',
      zContent: this.groupDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitGroup();
        return false;
      },
    });
  }

  submitGroup() {
    if (this.groupForm.invalid) {
      toast.error('Please fill required fields');
      return;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateGroup(this.selectedGroupId!, this.groupForm.value)
      : this.adminService.createGroup(this.groupForm.value);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${this.isEditing ? 'updated' : 'created'} successfully`);
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

  toggleGroupStatus(group: Group) {
    const obs = group.status === 'ACTIVE'
      ? this.adminService.deactivateGroup(group.id)
      : this.adminService.activateGroup(group.id);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${group.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
        this.refresh$.next();
      },
      error: (err) => toast.error(err.error?.message || 'Action failed')
    });
  }

  openTagDialog(group: Group) {
    this.targetGroup = group;
    this.tagForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: `Tag Activity to ${group.name}`,
      zContent: this.tagDialog,
      zOkText: 'Tag',
      zOnOk: () => {
        this.submitTag();
        return false;
      },
    });
  }

  submitTag() {
    if (this.tagForm.invalid) {
      toast.error('Please select an activity');
      return;
    }

    this.isSubmitting = true;
    this.adminService.tagGroupWithActivity({
      groupId: this.targetGroup!.id,
      activityId: Number(this.tagForm.value.activityId)
    }).subscribe({
      next: () => {
        toast.success('Activity tagged successfully');
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err.error?.message || 'Tagging failed');
        this.isSubmitting = false;
      }
    });
  }
}
