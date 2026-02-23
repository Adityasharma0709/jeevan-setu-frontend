import { Component, TemplateRef, ViewChild, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, combineLatest, map, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { AdminService, Activity } from '../admin.service';
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
export class Activities implements OnInit {
  @ViewChild('activityDialog') activityDialog!: TemplateRef<any>;

  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private dialog = inject(ZardDialogService);

  dialogRef!: ZardDialogRef<any>;
  activityForm!: FormGroup;

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedActivityId: number | null = null;

  activities$!: Observable<Activity[]>;
  projects$!: Observable<any[]>;
  private currentUserId: number | null = null;
  private assignedProjectIds = new Set<number>();

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;

    this.projects$ = this.adminService.getAssignedProjects(this.currentUserId || undefined);

    this.projects$.subscribe({
      next: (projects) => {
        this.assignedProjectIds = new Set((projects || []).map((p) => Number(p.id)));
      },
      error: () => {
        this.assignedProjectIds.clear();
      }
    });

    this.activities$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.projects$.pipe(startWith([] as any[]))
    ]).pipe(
      switchMap(() => this.adminService.getActivities()),
      map((activities) => (activities || []).filter((activity) => this.isActivityInAssignedProjects(activity)))
    );

    this.initForm();
  }

  private initForm() {
    this.activityForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      projectId: ['', Validators.required]
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
    const rawValue = this.activityForm.value;
    const payload: any = {
      name: rawValue.name,
      description: rawValue.description
    };

    if (rawValue.projectId) {
      const projectId = Number(rawValue.projectId);
      if (!this.assignedProjectIds.has(projectId)) {
        toast.error('You can only use projects assigned to you');
        this.isSubmitting = false;
        return;
      }
      payload.projectId = projectId;
    }

    const obs = this.isEditing
      ? this.adminService.updateActivity(this.selectedActivityId!, payload)
      : this.adminService.createActivity(payload);

    obs.subscribe({
      next: () => {
        toast.success(`Activity ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        const msg = err.error?.message;
        toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Something went wrong'));
        this.isSubmitting = false;
      }
    });
  }

  deactivateActivity(activity: Activity) {
    if (!this.canToggleStatus(activity)) {
      toast.error('You can only deactivate activities from your assigned projects');
      return;
    }
    if (!confirm('Are you sure you want to deactivate this activity?')) return;

    this.adminService.deactivateActivity(activity.id).subscribe({
      next: () => {
        toast.success('Activity deactivated');
        this.refresh$.next();
      },
      error: (err) => toast.error(err.error?.message || 'Failed to deactivate')
    });
  }

  activateActivity(activity: Activity) {
    if (!this.canToggleStatus(activity)) {
      toast.error('You can only activate activities from your assigned projects');
      return;
    }
    if (!confirm('Are you sure you want to activate this activity?')) return;

    this.adminService.activateActivity(activity.id).subscribe({
      next: () => {
        toast.success('Activity activated');
        this.refresh$.next();
      },
      error: (err) => {
        const msg = err.error?.message;
        toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Failed to activate'));
      }
    });
  }

  canToggleStatus(activity: Activity): boolean {
    const creatorId = this.getCreatorId(activity);
    const isOwnedByCurrentAdmin = !!creatorId && !!this.currentUserId && creatorId === this.currentUserId;
    const isInAssignedProjects = this.isActivityInAssignedProjects(activity);
    return isInAssignedProjects || isOwnedByCurrentAdmin;
  }

  private isActivityInAssignedProjects(activity: Activity): boolean {
    if (!activity?.projectId) return false;
    return this.assignedProjectIds.has(Number(activity.projectId));
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }
}
