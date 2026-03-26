import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { Observable, Subject, combineLatest, map, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AdminService, Session, Activity } from '../admin.service';
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
  selector: 'app-sessions',
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
  templateUrl: './sessions.html',
  styleUrl: './sessions.css',
})
export class Sessions {
  @ViewChild('sessionDialog') sessionDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  sessionForm!: FormGroup;
  activityControl = new FormControl('');

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  options: AnimationOptions = { path: '/loading.json' };
  selectedSessionId: number | null = null;
  readonly sessionStatusLoadingIds = signal<Set<number>>(new Set());

  activities$: Observable<Activity[]>;
  sessions$: Observable<Session[]>;
  private currentUserId: number | null = null;
  private currentUserEmail: string | null = null;
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
    this.currentUserEmail = currentUser?.email ? String(currentUser.email).toLowerCase() : null;

    const assignedProjects$ = this.adminService.getAssignedProjects(this.currentUserId || undefined);
    assignedProjects$.subscribe({
      next: (projects) => {
        this.assignedProjectIds = new Set((projects || []).map((p) => Number(p.id)));
      },
      error: () => {
        this.assignedProjectIds.clear();
      }
    });

    this.activities$ = combineLatest([
      this.adminService.getActivities(),
      assignedProjects$.pipe(startWith([] as any[]))
    ]).pipe(
      map(([activities]) => (activities || []).filter((activity) => this.isActivityInAssignedProjects(activity)))
    );
    this.activities$.subscribe({
      next: (activities) => {
        this.allowedActivityIds = new Set((activities || []).map((activity) => Number(activity.id)));
        this.refresh$.next();
      },
      error: () => {
        this.allowedActivityIds.clear();
        this.refresh$.next();
      }
    });

    this.sessions$ = this.activityControl.valueChanges.pipe(
      startWith(''),
      switchMap((activityId) => this.refresh$.pipe(
        startWith(void 0),
        switchMap(() => this.adminService.getAllSessions()),
        map((sessions) => {
          const selectedActivityId = activityId ? Number(activityId) : null;
          if (!selectedActivityId) return sessions || [];
          return (sessions || []).filter((session) => Number(session.activityId) === selectedActivityId);
        })
      )),
      map((sessions) => (sessions || []).filter((session) => this.isSessionAllowed(session)))
    );

    this.initForm();
  }

  private initForm() {
    this.sessionForm = this.fb.group({
      name: ['', Validators.required],
      sessionDate: ['', Validators.required],
      activityId: ['', Validators.required],
    });
  }

  openCreateDialog() {
    this.isEditing = false;
    this.sessionForm.reset();

    // Auto-select activity if one is already filtered
    if (this.activityControl.value) {
      this.sessionForm.patchValue({ activityId: this.activityControl.value });
    }

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Session',
      zContent: this.sessionDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitSession();
        return false;
      },
    });
  }

  openEditDialog(session: Session) {
    this.isEditing = true;
    this.selectedSessionId = session.id;

    // Format date for input[type="date"]
    const date = new Date(session.sessionDate).toISOString().split('T')[0];
    this.sessionForm.patchValue({
      ...session,
      sessionDate: date
    });

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Session',
      zContent: this.sessionDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitSession();
        return false;
      },
    });
  }

  submitSession() {
    if (this.sessionForm.invalid) {
      toast.error('Please fill all required fields');
      return;
    }

    const selectedActivityId = Number(this.sessionForm.value.activityId);
    if (!this.allowedActivityIds.has(selectedActivityId)) {
      toast.error('You can only use activities from projects assigned to you');
      return;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateSession(this.selectedSessionId!, this.sessionForm.value)
      : this.adminService.createSession(this.sessionForm.value);

    obs.subscribe({
      next: () => {
        toast.success(`Session ${this.isEditing ? 'updated' : 'created'} successfully`);
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

  deactivateSession(session: Session) {
    if (!this.canToggleStatus(session)) {
      toast.error('You can only deactivate sessions from your assigned activities');
      return;
    }
    if (!confirm('Are you sure you want to deactivate this session?')) return;

    const sessionId = Number(session?.id);
    if (!Number.isFinite(sessionId)) return;
    if (this.sessionStatusLoadingIds().has(sessionId)) return;

    const nextSet = new Set(this.sessionStatusLoadingIds());
    nextSet.add(sessionId);
    this.sessionStatusLoadingIds.set(nextSet);

    this.adminService.deactivateSession(session.id).subscribe({
      next: () => {
        toast.success('Session deactivated');
        this.refresh$.next();

        const done = new Set(this.sessionStatusLoadingIds());
        done.delete(sessionId);
        this.sessionStatusLoadingIds.set(done);
      },
      error: (err) => {
        const done = new Set(this.sessionStatusLoadingIds());
        done.delete(sessionId);
        this.sessionStatusLoadingIds.set(done);
        toast.error(err.error?.message || 'Failed to deactivate');
      }
    });
  }

  activateSession(session: Session) {
    if (!this.canToggleStatus(session)) {
      toast.error('You can only activate sessions from your assigned activities');
      return;
    }
    if (!confirm('Are you sure you want to activate this session?')) return;

    const sessionId = Number(session?.id);
    if (!Number.isFinite(sessionId)) return;
    if (this.sessionStatusLoadingIds().has(sessionId)) return;

    const nextSet = new Set(this.sessionStatusLoadingIds());
    nextSet.add(sessionId);
    this.sessionStatusLoadingIds.set(nextSet);

    this.adminService.activateSession(session.id).subscribe({
      next: () => {
        setTimeout(() => toast.success('Session activated'), 0);
        this.refresh$.next();

        const done = new Set(this.sessionStatusLoadingIds());
        done.delete(sessionId);
        this.sessionStatusLoadingIds.set(done);
      },
      error: (err) => {
        const done = new Set(this.sessionStatusLoadingIds());
        done.delete(sessionId);
        this.sessionStatusLoadingIds.set(done);
        setTimeout(() => toast.error(err.error?.message || 'Failed to activate'), 0);
      }
    });
  }

  isSessionStatusLoading(sessionId: number): boolean {
    return this.sessionStatusLoadingIds().has(sessionId);
  }

  canToggleStatus(session: Session): boolean {
    const activityAllowed = this.allowedActivityIds.has(Number(session?.activityId));
    const isOwnSession = this.isOwnedByCurrentAdmin(session);
    return activityAllowed || isOwnSession;
  }

  private isActivityInAssignedProjects(activity: Activity): boolean {
    if (!activity?.projectId) return false;
    return this.assignedProjectIds.has(Number(activity.projectId));
  }

  private isSessionAllowed(session: Session): boolean {
    const activityAllowed = this.allowedActivityIds.has(Number(session?.activityId));
    const isOwnSession = this.isOwnedByCurrentAdmin(session);
    return activityAllowed || isOwnSession;
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }

  private isOwnedByCurrentAdmin(entity: any): boolean {
    const creatorId = this.getCreatorId(entity);
    if (!!creatorId && !!this.currentUserId && creatorId === this.currentUserId) {
      return true;
    }
    const creatorEmail = entity?.creator?.email || entity?.createdBy?.email;
    if (!creatorEmail || !this.currentUserEmail) {
      return false;
    }
    return String(creatorEmail).toLowerCase() === this.currentUserEmail;
  }
}
