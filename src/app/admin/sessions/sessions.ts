import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, combineLatest, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap, tap } from 'rxjs';
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
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';

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
    ZardSwitchComponent,
    ZardComboboxComponent,
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
  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });
  searchControl = new FormControl('');

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  options: AnimationOptions = { path: '/loading.json' };
  selectedSessionId: number | null = null;
  readonly sessionStatusLoadingIds = signal<Set<number>>(new Set());

  activities$: Observable<Activity[]>;
  activityOptions$!: Observable<ZardComboboxOption[]>;
  sessions$!: Observable<Session[]>;
  pager$!: Observable<{
    items: Session[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  private currentUserId: number | null = null;
  private currentUserEmail: string | null = null;
  private assignedProjectIds = new Set<number>();
  private allowedActivityIds = new Set<number>();

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

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
      map(([activities]) =>
        (activities || []).filter(
          (activity) => this.isActivityInAssignedProjects(activity) && (activity?.status ?? '').toString().toUpperCase() === 'ACTIVE'
        )
      )
    );

    this.activityOptions$ = this.activities$.pipe(
      map(activities => (activities || []).map(a => ({
        label: a.name,
        value: a.id.toString()
      })))
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

    const status$ = this.statusFilter.valueChanges.pipe(
      startWith(this.statusFilter.value),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const search$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const baseSessions$ = this.activityControl.valueChanges.pipe(
      startWith(''),
      tap(() => this.goToPage(1)),
      switchMap((activityId) => this.refresh$.pipe(
        startWith(void 0),
        tap(() => this.goToPage(1)),
        switchMap(() => this.adminService.getAllSessions()),
        map((sessions) => {
          const selectedActivityId = activityId ? Number(activityId) : null;
          if (!selectedActivityId) return sessions || [];
          return (sessions || []).filter((session) => Number(session.activityId) === selectedActivityId);
        })
      )),
      map((sessions) => (sessions || []).filter((session) => this.isOwnedByCurrentAdmin(session))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const searchedSessions$ = combineLatest([baseSessions$, search$]).pipe(
      map(([sessions]) => {
        const query = (this.searchControl.value || '').toString().trim().toLowerCase();
        if (!query) return sessions;
        const includes = (value: unknown) => String(value ?? '').toLowerCase().includes(query);
        return (sessions || []).filter((s) => includes(s.name));
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.sessions$ = combineLatest([searchedSessions$, status$]).pipe(
      map(([sessions, status]) => {
        const normalized = (status ?? 'ALL').toString().toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE';
        if (normalized === 'ALL') return sessions;
        return (sessions || []).filter((s) => (s?.status ?? '').toString().toUpperCase() === normalized);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.pager$ = combineLatest([this.sessions$, this.page$]).pipe(
      map(([sessions, page]) => {
        const total = (sessions || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (sessions || []).slice(startIndex, endIndexExclusive);

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
    this.sessionForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]*$/), Validators.maxLength(50)]],
      activityId: ['', Validators.required],
      sessionDate: [new Date().toISOString().split('T')[0], Validators.required],
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

    this.sessionForm.patchValue({
      name: session.name,
      activityId: (session as any)?.activityId ?? '',
      sessionDate: session.sessionDate ? new Date(session.sessionDate).toISOString().split('T')[0] : '',
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
      this.sessionForm.markAllAsTouched();
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

  toggleSessionStatus(session: Session, checked: boolean) {
    const isActive = (session?.status ?? '').toString().toUpperCase() === 'ACTIVE';
    const targetActive = !!checked;
    if (targetActive === isActive) return;

    if (targetActive) {
      this.activateSession(session);
    } else {
      this.deactivateSession(session);
    }
  }

  deactivateSession(session: Session) {
    if (!this.canToggleStatus(session)) {
      toast.error('You can only deactivate sessions created by you');
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
      toast.error('You can only activate sessions created by you');
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
    return this.isOwnedByCurrentAdmin(session);
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

  getErrorMessage(err: any, fallback: string): string {
    if (err instanceof FormGroup || err instanceof FormControl) {
      if (err.valid || (!err.touched && !err.dirty)) return '';
      const fieldName = (fallback || '').toString().toLowerCase();
      if (err.hasError('required')) return `${fallback} is required`;
      if (err.hasError('pattern')) {
        if (fieldName.includes('name')) return 'Only letters and spaces are allowed';
        return `Invalid ${fallback} format`;
      }
      if (err.hasError('maxlength')) {
        const max = err.getError('maxlength')?.requiredLength;
        return `${fallback} cannot exceed ${max} characters`;
      }
      return '';
    }
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg[0] : (msg || fallback);
  }
}
