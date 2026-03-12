import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, combineLatest, map, startWith, switchMap, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AdminService, Group, Activity } from '../admin.service';
import { AuthService } from '../../core/services/auth';
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
    LottieComponent,
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

  options: AnimationOptions = {
    path: '/loading.json',
  };

  isLoading = true;
  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedGroupId: number | null = null;
  targetGroup: Group | null = null;

  groups$!: Observable<Group[]>;
  activities$!: Observable<Activity[]>;
  private currentUserId: number | null = null;
  private assignedProjectIds = new Set<number>();
  private allowedActivityIds = new Set<number>();

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private dialog: ZardDialogService,
    private authService: AuthService
  ) {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;

    const assignedProjects$ = this.adminService.getAssignedProjects(this.currentUserId || undefined);
    assignedProjects$.subscribe({
      next: (projects) => {
        this.assignedProjectIds = new Set((projects || []).map((p) => Number(p.id)));
      },
      error: () => {
        this.assignedProjectIds.clear();
      }
    });

    this.groups$ = combineLatest([
      this.refresh$.pipe(startWith(void 0), tap(() => this.isLoading = true)),
      assignedProjects$.pipe(startWith([] as any[]))
    ]).pipe(
      switchMap(() => this.adminService.getGroups()),
      map((groups) => (groups || []).filter((group) => this.isGroupInAssignedProjects(group))),
      tap(() => this.isLoading = false)
    );

    this.activities$ = combineLatest([
      this.adminService.getActivities(),
      assignedProjects$.pipe(startWith([] as any[]))
    ]).pipe(
      map(([activities]) => (activities || []).filter((activity) => this.isActivityInAssignedProjects(activity)))
    );
    this.activities$.subscribe({
      next: (activities) => {
        this.allowedActivityIds = new Set((activities || []).map((activity) => Number(activity.id)));
      },
      error: () => {
        this.allowedActivityIds.clear();
      }
    });
    this.initForms();
  }

  private initForms() {
    this.groupForm = this.fb.group({
      name: ['', Validators.required],
      minAge: [null],
      maxAge: [null],
      activityId: [''],
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

    const formValue = this.groupForm.value;
    const payload = {
      ...formValue,
      minAge: formValue.minAge != null && formValue.minAge !== '' ? Number(formValue.minAge) : 0,
      maxAge: formValue.maxAge != null && formValue.maxAge !== '' ? Number(formValue.maxAge) : 100,
    };

    if (formValue.activityId) {
      payload.activityId = Number(formValue.activityId);
    } else {
      delete payload.activityId;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateGroup(this.selectedGroupId!, payload)
      : this.adminService.createGroup(payload);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        let errorMessage = 'Something went wrong';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  toggleGroupStatus(group: Group) {
    if (!this.canToggleStatus(group)) {
      toast.error('You can only activate/deactivate groups created by you');
      return;
    }
    const obs = group.status === 'ACTIVE'
      ? this.adminService.deactivateGroup(group.id)
      : this.adminService.activateGroup(group.id);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${group.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
        this.refresh$.next();
      },
      error: (err) => {
        let errorMessage = 'Action failed';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);
      }
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

    const activityId = Number(this.tagForm.value.activityId);
    if (!this.allowedActivityIds.has(activityId)) {
      toast.error('You can only tag activities from projects assigned to you');
      return;
    }

    this.isSubmitting = true;
    this.adminService.tagGroupWithActivity({
      groupId: this.targetGroup!.id,
      activityId
    }).subscribe({
      next: () => {
        toast.success('Activity tagged successfully');
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        let errorMessage = 'Tagging failed';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  canToggleStatus(group: Group): boolean {
    const creatorId = this.getCreatorId(group);
    return !!creatorId && !!this.currentUserId && creatorId === this.currentUserId;
  }

  private isActivityInAssignedProjects(activity: Activity): boolean {
    if (!activity?.projectId) return false;
    return this.assignedProjectIds.has(Number(activity.projectId));
  }

  private isGroupInAssignedProjects(group: Group): boolean {
    const linkedActivities = group?.activities || [];
    if (!linkedActivities.length) {
      const creatorId = this.getCreatorId(group);
      return !!creatorId && !!this.currentUserId && creatorId === this.currentUserId;
    }
    return linkedActivities.some((ga: any) => this.isActivityInAssignedProjects(ga?.activity));
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }
}
