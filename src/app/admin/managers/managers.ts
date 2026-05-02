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
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { AuthService } from '../../core/services/auth';
import { ApiService } from '../../core/services/api';

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
    ZardSwitchComponent,
    ZardComboboxComponent,
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
  @ViewChild('removeManagerDialog') removeManagerDialog!: TemplateRef<any>;

  projectToRemoveCtrl = new FormControl('', Validators.required);
  managerProjects: ZardComboboxOption[] = [];
  fetchingManagerProjects = false;
  removingProjectLoading = signal(false);

  dialogRef!: ZardDialogRef<any>;
  managerForm!: FormGroup;
  assignForm!: FormGroup;
  searchControl = new FormControl('');
  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  projectOptions$!: Observable<ZardComboboxOption[]>;
  assignStateOptions$!: Observable<ZardComboboxOption[]>;
  managerStateOptions$!: Observable<ZardComboboxOption[]>;

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
  readonly assignStatesLoading = signal(false);
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
  states$!: Observable<any[]>;
  managerStates$!: Observable<any[]>;
  private projectsCache: any[] = [];
  assignStatesCache: any[] = [];
  private currentUserId: number | null = null;
  private currentUserRoles: string[] = [];
  readonly managerStatusLoadingIds = signal<Set<number>>(new Set());

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

  get selectedStatesLabel(): string {
    const rawStateId = this.assignForm?.get('stateId')?.value;
    const stateId = Number(rawStateId);
    if (!Number.isFinite(stateId) || stateId <= 0) return 'Select state';
    const state = this.assignStatesCache.find((l: any) => Number(l?.id) === stateId);
    if (!state) return 'Select state';
    return this.formatStateLabel(state) || 'Select state';
  }

  formatStateLabel(l: any): string {
    if (!l) return '';
    const code = (l.locationCode ?? '').toString().trim();
    const name = l.name || l.label || l.stateName || '';
    return [code, name].filter(Boolean).join(' - ');
  }

  selectAssignProject(project: any) {
    const id = Number(project?.id);
    if (!Number.isFinite(id)) return;
    this.assignForm.get('projectId')?.setValue(id);
    this.assignForm.get('projectId')?.markAsDirty();
  }

  clearAssignProjectSelection() {
    this.assignForm.get('projectId')?.setValue(null);
    this.assignForm.get('stateId')?.setValue(null);
    this.assignForm.get('projectId')?.markAsDirty();
    this.assignForm.get('stateId')?.markAsDirty();
  }

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private fb: FormBuilder,
    private managersService: ManagersService,
    private dialog: ZardDialogService,
    private authService: AuthService,
    private api: ApiService
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
    this.currentUserRoles = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
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

    this.projectOptions$ = this.projects$.pipe(
      map(projects => (projects || []).map(p => ({
        label: `${p.name} ${p.projectCode ? '(' + p.projectCode + ')' : ''}`,
        value: p.id.toString()
      })))
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
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]*$/), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Only required during creation
      projectId: [''],
      stateId: [''],
    });

    this.assignForm = this.fb.group({
      projectId: [null, Validators.required],
      stateId: [null, Validators.required],
    });

    this.states$ = this.assignForm.get('projectId')!.valueChanges.pipe(
      startWith(this.assignForm.get('projectId')!.value),
      tap(() => this.assignForm.patchValue({ stateId: null }, { emitEvent: false })),
      switchMap((id) => {
        const projectId = Number(id);
        if (!Number.isFinite(projectId) || projectId <= 0) {
          this.assignStatesLoading.set(false);
          return of([]);
        }
        this.assignStatesLoading.set(true);
        return this.managersService.getProjectStates(projectId).pipe(
          startWith([]),
          catchError((err) => {
            toast.error(this.getErrorMessage(err, 'Failed to load locations'));
            return of([]);
          }),
          finalize(() => this.assignStatesLoading.set(false)),
        );
      }),
      tap((locations) => {
        this.assignStatesCache = Array.isArray(locations) ? locations : [];
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.assignStateOptions$ = this.states$.pipe(
      map(locations => (locations || []).map(l => ({
        label: this.formatStateLabel(l),
        value: l.id.toString()
      })))
    );

    this.managerStates$ = this.managerForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.managerForm.patchValue({ stateId: '' })),
      switchMap(id => (id ? this.managersService.getProjectStates(Number(id)) : of([]))),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.managerStateOptions$ = this.managerStates$.pipe(
      map(locations => (locations || []).map(l => ({
        label: this.formatStateLabel(l),
        value: l.id.toString()
      })))
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
      this.managerForm.markAllAsTouched();
      toast.error('Please fill all required fields correctly');
      return;
    }

    const formValue = this.managerForm.getRawValue();
    const selectedProjectId = this.parseOptionalId(formValue.projectId);
    const selectedLocationId = this.parseOptionalId(formValue.stateId);
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
      stateId: '',
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
      stateId: '',
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

  private validateAssignmentSelection(projectId: number | null, stateId: number | null): string | null {
    if (this.isEditing && (!!projectId !== !!stateId)) {
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
    stateId: number | null,
  ): any {
    const payload: any = {
      usercode: formValue.usercode,
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
    };
    if (projectId) payload.projectId = projectId;
    if (stateId) payload.stateId = stateId;
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
    const roles = this.currentUserRoles.map((r) => (r ?? '').toString().toUpperCase());
    if (roles.includes('SUPER_ADMIN')) return true;
    if (roles.includes('ADMIN')) {
      // If we don't know the creator, be conservative to avoid 403 from backend.
      if (!creatorId) return false;
      return !!this.currentUserId && creatorId === this.currentUserId;
    }
    return false;
  }

  openAssignDialog(manager: User) {
    this.targetManager = manager;
    this.assignForm.reset({ projectId: null, stateId: null });
    this.assignStatesCache = [];
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
        this.assignStatesCache = [];
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
        this.detailsProjects = list.map((p: any) => {
          // Normalize locations from possible keys (locations, awcs, or userProjectLocations)
          let rawLocations = p.locations || p.awcs || p.userProjectLocations || [];
          if (!Array.isArray(rawLocations)) rawLocations = [];

          // Extract actual location objects if they are wrapped (e.g., in userProjectLocations)
          const locations = rawLocations.map((item: any) => {
            if (item?.awc) return item.awc;
            if (item?.location) return item.location;
            return item;
          });

          return {
            ...p,
            locations: locations.filter((l: any) => {
              const status = (l?.status || 'ACTIVE').toString().toUpperCase();
              return status === 'ACTIVE';
            }),
          };
        });
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
    if (!this.targetManager || this.assignLoading() || this.assignForm.invalid) {
      if (this.assignForm.invalid) {
        this.assignForm.markAllAsTouched();
        toast.error('Please select both project and state');
      }
      return;
    }

    const { projectId, stateId } = this.assignForm.value;
    const targetUserId = this.targetManager.id;

    this.assignLoading.set(true);
    this.managersService.assignProject(targetUserId, Number(projectId), Number(stateId))
      .pipe(finalize(() => this.assignLoading.set(false)))
      .subscribe({
        next: () => {
          toast.success('Project and State assigned successfully');
          this.refresh$.next();
          this.dialogRef.close();
        },
        error: (err) => {
          toast.error(this.getErrorMessage(err, 'Assignment failed'));
        }
      });
  }

  openRemoveDialog(manager: User) {
    this.targetManager = manager;
    this.projectToRemoveCtrl.reset();
    this.managerProjects = [];
    this.fetchingManagerProjects = true;
    
    this.managersService.getProjects(manager.id).subscribe({
      next: (projects) => {
        const list = Array.isArray(projects) ? projects : [];
        this.managerProjects = list.map(p => ({
          label: `${p.name} ${p.projectCode ? '(' + p.projectCode + ')' : ''}`,
          value: p.id.toString()
        }));
        this.fetchingManagerProjects = false;
      },
      error: () => {
        toast.error('Failed to load manager projects');
        this.fetchingManagerProjects = false;
      }
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Remove ${manager.name} from Project`,
      zContent: this.removeManagerDialog,
      zOkText: 'Remove',
      zOkLoading: this.removingProjectLoading,
      zOnOk: () => {
        this.submitRemoveProject();
        return false;
      },
      zOnCancel: () => {
        this.targetManager = null;
      }
    });
  }

  submitRemoveProject() {
    if (this.projectToRemoveCtrl.invalid || !this.targetManager) {
        toast.error('Please select a project');
        return;
    }
    const projectId = Number(this.projectToRemoveCtrl.value);
    this.removingProjectLoading.set(true);

    this.api.delete(`users/manager/${this.targetManager.id}/project/${projectId}`).subscribe({
      next: () => {
        toast.success('Manager removed from project successfully');
        this.removingProjectLoading.set(false);
        this.dialogRef.close();
        this.refresh$.next();
      },
      error: (err: any) => {
        toast.error(this.getErrorMessage(err, 'Failed to remove from project'));
        this.removingProjectLoading.set(false);
      }
    });
  }



  getErrorMessage(err: any, fallback: string): string {
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

    if (err instanceof FormGroup || err instanceof FormControl) {
      if (err.valid || (!err.touched && !err.dirty)) return '';
      const fieldName = (fallback || '').toString().toLowerCase();
      if (err.hasError('required')) return `${fallback} is required`;
      if (err.hasError('email')) return 'Invalid email address';
      if (err.hasError('minlength')) {
        const min = err.getError('minlength')?.requiredLength;
        return `${fallback} must be at least ${min} characters`;
      }
      if (err.hasError('maxlength')) {
        const max = err.getError('maxlength')?.requiredLength;
        return `${fallback} cannot exceed ${max} characters`;
      }
      if (err.hasError('pattern')) {
        if (fieldName.includes('name')) return 'Only letters and spaces are allowed';
        return `Invalid ${fallback} format`;
      }
      return '';
    }

    return fallback;
  }

  private getCreatorId(entity: any): number | null {
    const directId =
      entity?.creator?.id ??
      entity?.createdBy?.id ??
      entity?.createdByAdmin?.id ??
      entity?.createdByAdminId ??
      entity?.createdById ??
      entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }
}
