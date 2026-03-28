import { Component, TemplateRef, ViewChild, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

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
    LottieComponent,
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

  options: AnimationOptions = { path: '/loading.json' };

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedActivityId: number | null = null;
  readonly activityStatusLoadingIds = signal<Set<number>>(new Set());
  searchControl = new FormControl('');

  activities$!: Observable<Activity[]>;
  pager$!: Observable<{
    items: Activity[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  projects$!: Observable<any[]>;
  private currentUserId: number | null = null;
  private currentUserEmail: string | null = null;
  private assignedProjectIds = new Set<number>();

  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;
    this.currentUserEmail = currentUser?.email ? String(currentUser.email).toLowerCase() : null;

    this.projects$ = this.adminService.getAssignedProjects(this.currentUserId || undefined).pipe(
      map((projects) => projects || []),
      tap((projects) => {
        this.assignedProjectIds = new Set((projects || []).map((p) => Number(p.id)));
      }),
      catchError(() => {
        this.assignedProjectIds.clear();
        return of([] as any[]);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const status$ = this.statusFilter.valueChanges.pipe(
      startWith(this.statusFilter.value),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
    );

    const search$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
    );

    const baseActivities$ = combineLatest([this.refresh$.pipe(startWith(void 0)), search$]).pipe(
      switchMap(() => this.adminService.getActivities()),
      map((activities) => (activities || []).filter((activity) => this.isOwnedByCurrentAdmin(activity))),
      map((activities) => {
        const query = (this.searchControl.value || '').toString().trim().toLowerCase();
        if (!query) return activities;

        const includes = (value: unknown) => String(value ?? '').toLowerCase().includes(query);
        return (activities || []).filter((a) =>
          includes(a.name) ||
          includes(a.description) ||
          includes(a.project?.name) ||
          includes(a.project?.projectCode)
        );
      }),
      catchError(() => of([] as Activity[])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.activities$ = combineLatest([baseActivities$, status$]).pipe(
      map(([activities, status]) => {
        const normalized = (status ?? 'ALL').toString().toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE';
        if (normalized === 'ALL') return activities;
        return (activities || []).filter((a) => (a?.status ?? '').toString().toUpperCase() === normalized);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.pager$ = combineLatest([this.activities$, this.page$]).pipe(
      map(([activities, page]) => {
        const total = (activities || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (activities || []).slice(startIndex, endIndexExclusive);

        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : endIndexExclusive;

        return {
          items,
          page: safePage,
          pageSize: this.pageSize,
          total,
          totalPages,
          from,
          to,
        };
      }),
      tap((vm) => {
        if (vm.page !== this.page$.getValue()) this.page$.next(vm.page);
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.initForm();
  }

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
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
      toast.error('You can only deactivate activities created by you');
      return;
    }
    if (!confirm('Are you sure you want to deactivate this activity?')) return;

    const activityId = Number(activity?.id);
    if (!Number.isFinite(activityId)) return;
    if (this.activityStatusLoadingIds().has(activityId)) return;

    const nextSet = new Set(this.activityStatusLoadingIds());
    nextSet.add(activityId);
    this.activityStatusLoadingIds.set(nextSet);

    this.adminService.deactivateActivity(activity.id).subscribe({
      next: () => {
        toast.success('Activity deactivated');
        this.refresh$.next();

        const done = new Set(this.activityStatusLoadingIds());
        done.delete(activityId);
        this.activityStatusLoadingIds.set(done);
      },
      error: (err) => {
        const done = new Set(this.activityStatusLoadingIds());
        done.delete(activityId);
        this.activityStatusLoadingIds.set(done);
        toast.error(err.error?.message || 'Failed to deactivate');
      }
    });
  }

  activateActivity(activity: Activity) {
    if (!this.canToggleStatus(activity)) {
      toast.error('You can only activate activities created by you');
      return;
    }
    if (!confirm('Are you sure you want to activate this activity?')) return;

    const activityId = Number(activity?.id);
    if (!Number.isFinite(activityId)) return;
    if (this.activityStatusLoadingIds().has(activityId)) return;

    const nextSet = new Set(this.activityStatusLoadingIds());
    nextSet.add(activityId);
    this.activityStatusLoadingIds.set(nextSet);

    this.adminService.activateActivity(activity.id).subscribe({
      next: () => {
        toast.success('Activity activated');
        this.refresh$.next();

        const done = new Set(this.activityStatusLoadingIds());
        done.delete(activityId);
        this.activityStatusLoadingIds.set(done);
      },
      error: (err) => {
        const done = new Set(this.activityStatusLoadingIds());
        done.delete(activityId);
        this.activityStatusLoadingIds.set(done);
        const msg = err.error?.message;
        toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Failed to activate'));
      }
    });
  }

  isActivityStatusLoading(activityId: number): boolean {
    return this.activityStatusLoadingIds().has(activityId);
  }

  canToggleStatus(activity: Activity): boolean {
    return this.isOwnedByCurrentAdmin(activity);
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
