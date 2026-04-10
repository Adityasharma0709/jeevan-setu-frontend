import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, startWith, switchMap, combineLatest, debounceTime, distinctUntilChanged, tap, of, map, shareReplay, take, from, concatMap, toArray, throwError, catchError, finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ManagersService, User } from './managers.service';
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
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-managers',
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
    ...ZardDropdownImports,
    LottieComponent,
  ],
  templateUrl: './managers.html',
  styleUrl: './managers.css',
})
export class Managers {
  @ViewChild('managerDialog') managerDialog!: TemplateRef<any>;
  @ViewChild('assignDialog') assignDialog!: TemplateRef<any>;
  @ViewChild('detailsDialog') detailsDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  managerForm!: FormGroup;
  assignForm!: FormGroup;
  searchControl = new FormControl('');
  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });

  private refresh$ = new Subject<void>();
  isEditing = false;
  selectedManagerId: number | null = null;
  options: AnimationOptions = { path: '/loading.json' };
  detailsLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };
  targetManager: User | null = null;
  detailsManager: User | null = null;
  detailsLoading = signal(false);
  readonly detailsLoadingManagerId = signal<number | null>(null);
  readonly assignLoading = signal(false);
  readonly projectsLoading = signal(true);
  readonly assignLocationsLoading = signal(false);
  detailsProjects: any[] = [];
  private detailsFetchToken = 0;

  managers$!: Observable<User[]>;
  pager$!: Observable<{
    items: User[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  projects$!: Observable<any[]>;
  locations$!: Observable<any[]>;
  managerLocations$!: Observable<any[]>;
  private projectsCache: any[] = [];
  private assignLocationsCache: any[] = [];
  private currentUserId: number | null = null;
  readonly managerStatusLoadingIds = signal<Set<number>>(new Set());
  pendingAssignments: Array<{ projectId: number; locationId: number; projectName: string; locationLabel: string }> = [];

  get selectedAssignProjectLabel(): string {
    const rawProjectId = this.assignForm?.get('projectId')?.value;
    const projectId = Number(rawProjectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return 'Select project';
    const project = this.projectsCache.find((p) => Number(p?.id) === projectId);
    if (!project) return 'Select project';
    const name = (project?.name ?? '').toString().trim();
    const code = (project?.projectCode ?? '').toString().trim();
    return [name, code ? `(${code})` : ''].filter(Boolean).join(' ');
  }

  get selectedLocationsLabel(): string {
    const rawLocationId = this.assignForm?.get('locationId')?.value;
    const locationId = Number(rawLocationId);
    if (!Number.isFinite(locationId) || locationId <= 0) return 'Select location';
    const location = this.assignLocationsCache.find((l: any) => Number(l?.id) === locationId);
    if (!location) return 'Select location';
    const label = `${location.locationCode ?? ''}${location.locationCode ? ' - ' : ''}${location.village ?? ''}${location.block ? `, ${location.block}` : ''}`.trim();
    return label || 'Select location';
  }

  selectAssignProject(project: any) {
    const id = Number(project?.id);
    if (!Number.isFinite(id)) return;
    this.assignForm.get('projectId')?.setValue(id);
    this.assignForm.get('projectId')?.markAsDirty();
  }

  clearAssignProjectSelection() {
    this.assignForm.get('projectId')?.setValue(null);
    this.clearLocationSelection();
    this.assignForm.get('projectId')?.markAsDirty();
  }

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private fb: FormBuilder,
    private managersService: ManagersService,
    private dialog: ZardDialogService,
    private authService: AuthService
  ) {
    const status$ = this.statusFilter.valueChanges.pipe(
      startWith(this.statusFilter.value),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const baseManagers$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      tap(() => this.goToPage(1)),
      switchMap(([_, query]) => this.managersService.findAll(query || '')),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.managers$ = combineLatest([baseManagers$, status$]).pipe(
      map(([managers, status]) => {
        const normalized = (status ?? 'ALL').toString().toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE';
        if (normalized === 'ALL') return managers || [];
        return (managers || []).filter((m) => (m?.status ?? '').toString().toUpperCase() === normalized);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.pager$ = combineLatest([this.managers$, this.page$]).pipe(
      map(([managers, page]) => {
        const total = (managers || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (managers || []).slice(startIndex, endIndexExclusive);

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

    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;
    this.projects$ = of(null).pipe(
      tap(() => this.projectsLoading.set(true)),
      switchMap(() => this.managersService.getProjects(currentUser?.sub)),
      tap((projects) => {
        this.projectsCache = Array.isArray(projects) ? projects : [];
      }),
      catchError((err) => {
        toast.error(this.getErrorMessage(err, 'Failed to load projects'));
        this.projectsCache = [];
        return of([]);
      }),
      finalize(() => this.projectsLoading.set(false)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.initForms();
    this.projects$.pipe(take(1)).subscribe();
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

  private initForms() {
    this.managerForm = this.fb.group({
      usercode: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Only required during creation
      projectId: [''],
      locationId: [''],
    });

    this.assignForm = this.fb.group({
      projectId: [null, Validators.required],
      locationId: [null, Validators.required],
    });

    this.locations$ = this.assignForm.get('projectId')!.valueChanges.pipe(
      startWith(this.assignForm.get('projectId')!.value),
      tap(() => this.assignForm.patchValue({ locationId: null }, { emitEvent: false })),
      switchMap((id) => {
        const projectId = Number(id);
        if (!Number.isFinite(projectId) || projectId <= 0) {
          this.assignLocationsLoading.set(false);
          return of([]);
        }
        this.assignLocationsLoading.set(true);
        return this.managersService.getLocations(projectId).pipe(
          startWith([]),
          catchError((err) => {
            toast.error(this.getErrorMessage(err, 'Failed to load locations'));
            return of([]);
          }),
          finalize(() => this.assignLocationsLoading.set(false)),
        );
      }),
      tap((locations) => {
        this.assignLocationsCache = Array.isArray(locations) ? locations : [];
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.managerLocations$ = this.managerForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.managerForm.patchValue({ locationId: '' })),
      switchMap(id => (id ? this.managersService.getLocations(Number(id)) : of([])))
    );
  }

  openCreateDialog() {
    this.prepareCreateForm();

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Manager',
      zContent: this.managerDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitManager();
        return false;
      },
    });
  }

  openEditDialog(manager: User) {
    this.prepareEditForm(manager);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Manager',
      zContent: this.managerDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitManager();
        return false;
      },
    });
  }

  submitManager() {
    if (this.managerForm.invalid) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    const formValue = this.managerForm.getRawValue();
    const selectedProjectId = this.parseOptionalId(formValue.projectId);
    const selectedLocationId = this.parseOptionalId(formValue.locationId);
    const assignmentError = this.validateAssignmentSelection(selectedProjectId, selectedLocationId);
    if (assignmentError) {
      toast.error(assignmentError);
      return;
    }

    const createPayload = this.buildCreatePayload(formValue, selectedProjectId, selectedLocationId);
    const updatePayload = this.buildUpdatePayload(formValue);
    const shouldAssignInEdit = this.isEditing && !!selectedProjectId && !!selectedLocationId;

    const obs = this.isEditing
      ? this.managersService.update(this.selectedManagerId!, updatePayload).pipe(
        switchMap(() =>
          shouldAssignInEdit
            ? this.managersService.assignProject(this.selectedManagerId!, selectedProjectId!, selectedLocationId!)
            : of(null)
        )
      )
      : this.managersService.create(createPayload);

    obs.subscribe({
      next: (res: any) => {
        const createdCode =
          res?.safeUser?.usercode ??
          res?.usercode ??
          res?.user?.usercode;

        const successMessage = this.isEditing
          ? (shouldAssignInEdit ? 'Manager updated and reassigned successfully' : 'Manager updated successfully')
          : (createdCode ? `Manager created (Code: ${createdCode})` : 'Manager created successfully');
        toast.success(successMessage);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Something went wrong'));
      }
    });
  }

  private prepareCreateForm(): void {
    this.isEditing = false;
    this.selectedManagerId = null;
    this.managerForm.reset({
      usercode: { value: 'MC01', disabled: true },
      name: '',
      email: '',
      password: '',
      projectId: '',
      locationId: '',
    });
    this.setPasswordValidators(true);
    this.populateNextManagerCode();
  }

  private prepareEditForm(manager: User): void {
    this.isEditing = true;
    this.selectedManagerId = manager.id;
    this.managerForm.reset({
      usercode: { value: manager?.usercode ?? '', disabled: true },
      name: manager.name,
      email: manager.email,
      password: '',
      projectId: '',
      locationId: '',
    });
    this.setPasswordValidators(false);
  }

  private setPasswordValidators(required: boolean): void {
    const control = this.managerForm.get('password');
    if (!control) return;
    if (required) {
      control.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity();
  }

  private parseOptionalId(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private validateAssignmentSelection(projectId: number | null, locationId: number | null): string | null {
    if (this.isEditing && (!!projectId !== !!locationId)) {
      return 'For edit reassignment, select both project and location';
    }

    if (projectId) {
      const selectedProject = this.projectsCache.find((p) => Number(p?.id) === projectId);
      if (!selectedProject) {
        return 'Selected project is inactive or unavailable';
      }
    }

    return null;
  }

  private buildCreatePayload(
    formValue: any,
    projectId: number | null,
    locationId: number | null,
  ): any {
    const payload: any = {
      usercode: formValue.usercode,
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
    };
    if (projectId) payload.projectId = projectId;
    if (locationId) payload.locationId = locationId;
    return payload;
  }

  private buildUpdatePayload(formValue: any): any {
    return {
      name: formValue.name,
      email: formValue.email,
      ...(formValue.password ? { password: formValue.password } : {}),
    };
  }

  private populateNextManagerCode(): void {
    this.managersService
      .getNextManagerCode()
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          const raw = res?.code ?? res?.nextCode ?? res?.usercode ?? res?.data?.code ?? res?.data?.nextCode;
          const code = raw == null ? '' : String(raw).trim();
          if (code) {
            this.managerForm.get('usercode')?.setValue(code, { emitEvent: false });
          }
        },
        error: () => {
          // keep fallback code if fetch fails
        },
      });
  }

  toggleManagerStatus(manager: User) {
    if (!this.canToggleStatus(manager)) {
      toast.error('You can only activate/deactivate managers created by you');
      return;
    }
    const managerId = Number(manager?.id);
    if (!Number.isFinite(managerId)) return;
    if (this.managerStatusLoadingIds().has(managerId)) return;

    const nextSet = new Set(this.managerStatusLoadingIds());
    nextSet.add(managerId);
    this.managerStatusLoadingIds.set(nextSet);

    const nextStatus = manager.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.managersService.updateStatus(manager.id, nextStatus).subscribe({
      next: () => {
        toast.success(nextStatus === 'ACTIVE' ? 'Manager activated' : 'Manager deactivated');
        this.refresh$.next();

        const done = new Set(this.managerStatusLoadingIds());
        done.delete(managerId);
        this.managerStatusLoadingIds.set(done);
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Failed to update status'));

        const done = new Set(this.managerStatusLoadingIds());
        done.delete(managerId);
        this.managerStatusLoadingIds.set(done);
      }
    });
  }

  isManagerStatusLoading(managerId: number): boolean {
    return this.managerStatusLoadingIds().has(managerId);
  }

  canToggleStatus(manager: User): boolean {
    const creatorId = this.getCreatorId(manager);
    return !!creatorId && !!this.currentUserId && creatorId === this.currentUserId;
  }

  openAssignDialog(manager: User) {
    this.targetManager = manager;
    this.assignForm.reset({ projectId: null, locationId: null });
    this.pendingAssignments = [];
    this.assignLocationsCache = [];
    this.assignLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Projects & Locations to ${manager.name}`,
      zContent: this.assignDialog,
      zOkText: 'Save',
      zOkLoading: this.assignLoading,
      zWidth: '800px',
      zOnOk: () => {
        this.submitAssignment();
        return false;
      },
      zOnCancel: () => {
        this.targetManager = null;
        this.pendingAssignments = [];
        this.assignLocationsCache = [];
        this.assignLoading.set(false);
      },
    });
  }

  openDetailsDialog(manager: User) {
    if (this.isDetailsLoading(manager.id)) return;

    const token = ++this.detailsFetchToken;
    this.detailsManager = manager;
    this.detailsProjects = [];
    this.detailsLoading.set(true);
    this.detailsLoadingManagerId.set(manager.id);

    this.managersService.getProjects(manager.id).subscribe({
      next: (projects) => {
        if (token !== this.detailsFetchToken) return;
        const list = Array.isArray(projects) ? projects : [];
        this.detailsProjects = list.map((p: any) => ({
          ...p,
          locations: Array.isArray(p?.locations)
            ? p.locations.filter((l: any) => (l?.status ?? '').toString().toUpperCase() === 'ACTIVE')
            : [],
        }));
        this.detailsLoading.set(false);
        this.detailsLoadingManagerId.set(null);
      },
      error: (err) => {
        if (token !== this.detailsFetchToken) return;
        this.detailsProjects = [];
        this.detailsLoading.set(false);
        this.detailsLoadingManagerId.set(null);
        toast.error(this.getErrorMessage(err, 'Failed to load assigned projects'));
      },
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Assigned Projects: ${manager.name}`,
      zContent: this.detailsDialog,
      zOkText: 'Close',
      zOkLoading: this.detailsLoading,
      zOnOk: () => {
        this.detailsFetchToken++;
        this.detailsManager = null;
        this.detailsProjects = [];
        this.detailsLoading.set(false);
        this.detailsLoadingManagerId.set(null);
      },
      zOnCancel: () => {
        this.detailsFetchToken++;
        this.detailsManager = null;
        this.detailsProjects = [];
        this.detailsLoading.set(false);
        this.detailsLoadingManagerId.set(null);
      },
    });
  }

  isDetailsLoading(managerId: number): boolean {
    return this.detailsLoading() && this.detailsLoadingManagerId() === managerId;
  }

  submitAssignment() {
    if (!this.targetManager) return;
    if (this.assignLoading()) return;

    const targetUserId = Number(this.targetManager.id);
    if (!Number.isFinite(targetUserId)) return;

    this.assignLoading.set(true);

    this.getAssignmentsToSubmit().pipe(
      switchMap((assignments) => {
        if (!assignments.length) {
          return throwError(() => new Error('No assignments selected'));
        }
        return from(assignments).pipe(
          concatMap((a) => {
            return this.managersService.assignProject(targetUserId, a.projectId, a.locationId).pipe(
              map(() => ({ ...a, status: 'ASSIGNED' as const })),
              catchError((err) => {
                if (err?.status === 409) {
                  return of({ ...a, status: 'SKIPPED' as const });
                }
                return throwError(() => err);
              }),
            );
          }),
          toArray(),
        );
      }),
      finalize(() => this.assignLoading.set(false)),
    ).subscribe({
      next: (results) => {
        const assignedCount = results.filter((r) => r.status === 'ASSIGNED').length;
        const skippedCount = results.filter((r) => r.status === 'SKIPPED').length;

        if (assignedCount) {
          toast.success(assignedCount > 1 ? 'Assignments saved successfully' : 'Assignment saved successfully');
        }
        if (skippedCount) {
          toast.info(`${skippedCount} already assigned`);
        }
        if (!assignedCount && !skippedCount) {
          toast.info('No changes');
        }
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Assignment failed'));
      },
    });
  }

  addToPendingAssignments() {
    const projectIdNum = Number(this.assignForm.get('projectId')?.value);
    const locationIdNum = Number(this.assignForm.get('locationId')?.value);

    if (!Number.isFinite(projectIdNum) || projectIdNum <= 0 || !Number.isFinite(locationIdNum) || locationIdNum <= 0) {
      toast.error('Select a project and a location');
      return;
    }

    const selectedProject = this.projectsCache.find((p) => Number(p?.id) === projectIdNum);
    if (!selectedProject) {
      toast.error('Selected project is inactive or unavailable');
      return;
    }

    const key = `${projectIdNum}:${locationIdNum}`;
    const seen = new Set(this.pendingAssignments.map((a) => `${a.projectId}:${a.locationId}`));
    if (seen.has(key)) {
      toast.info('Already added');
      return;
    }

    const location = this.assignLocationsCache.find((l: any) => Number(l?.id) === locationIdNum);
    const locationLabel = location
      ? `${location.locationCode ?? ''}${location.locationCode ? ' - ' : ''}${location.village ?? ''}${location.block ? `, ${location.block}` : ''}`.trim() || `#${locationIdNum}`
      : `#${locationIdNum}`;

    this.pendingAssignments = [
      ...this.pendingAssignments,
      {
        projectId: projectIdNum,
        locationId: locationIdNum,
        projectName: `${selectedProject.name ?? ''}`.trim() || `#${projectIdNum}`,
        locationLabel,
      }
    ];
    this.assignForm.patchValue({ locationId: null }, { emitEvent: false });
  }

  clearPendingAssignments() {
    this.pendingAssignments = [];
  }

  selectAllLocations() {
    const ids = (this.assignLocationsCache || [])
      .map((l: any) => Number(l?.id))
      .filter((n: number) => Number.isFinite(n));
    this.assignForm.get('locationId')?.setValue(ids[0] ?? null);
    this.assignForm.get('locationId')?.markAsDirty();
  }

  clearLocationSelection() {
    this.assignForm.get('locationId')?.setValue(null);
    this.assignForm.get('locationId')?.markAsDirty();
  }

  removePendingAssignment(projectId: number, locationId: number) {
    this.pendingAssignments = this.pendingAssignments.filter(
      (a) => !(a.projectId === projectId && a.locationId === locationId),
    );
  }

  private getAssignmentsToSubmit(): Observable<Array<{ projectId: number; locationId: number }>> {
    if (this.pendingAssignments.length) {
      return of(this.pendingAssignments.map((a) => ({ projectId: a.projectId, locationId: a.locationId })));
    }

    const projectIdNum = Number(this.assignForm.get('projectId')?.value);
    const locationIdNum = Number(this.assignForm.get('locationId')?.value);

    if (!Number.isFinite(projectIdNum) || projectIdNum <= 0 || !Number.isFinite(locationIdNum) || locationIdNum <= 0) {
      return of([]);
    }

    return of([{ projectId: projectIdNum, locationId: locationIdNum }]);
  }

  private getErrorMessage(err: any, fallback: string): string {
    const status = Number(err?.status);
    const rawMessage = err?.message ?? err?.error?.message;
    const textMessage = typeof rawMessage === 'string' ? rawMessage : '';

    if (status === 0 || /ECONNREFUSED|ERR_CONNECTION_REFUSED|Failed to fetch/i.test(textMessage)) {
      return 'Unable to reach server. Please check your connection.';
    }
    if (status === 401) return 'Unauthorized. Please sign in again.';
    if (status === 403) return 'Access denied.';
    if (status === 404) return 'Requested resource not found.';
    if (status >= 500) return 'Server error. Please try again later.';

    const message = err?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') return JSON.stringify(message);
    return fallback;
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }
}
