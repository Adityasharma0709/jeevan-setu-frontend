import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal, computed } from '@angular/core';
import { afterNextRender } from '@angular/core';
import { Injector, runInInjectionContext } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, map, combineLatest, BehaviorSubject, forkJoin, shareReplay, tap, take, of, catchError } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '../../core/services/api';

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
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardIconComponent } from '@/shared/components/icon';

import { ProjectsService, Project } from './projects.service';

interface LocationModel {
  id: number;
  projectId: number | null;
  locationCode: string;
  state: any;
  district: any;
  block: string;
  village: string;
  project?: {
    id: number;
    name: string;
  };
}

interface ProjectWithLocations extends Project {
  locations?: LocationModel[];
}

interface ProjectPagerVm {
  items: ProjectWithLocations[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
}

type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-projects',
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
    ZardSwitchComponent,
    ZardIconComponent,
    ZardComboboxComponent,
    LottieComponent,
  ],
  templateUrl: './projects.html',
})
export class ProjectsComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly createProjectLoading = signal(false);
  readonly updateProjectLoading = signal(false);
  readonly assignAdminLoading = signal(false);
  readonly assignLocationLoading = signal(false);
  readonly createLocationLoading = signal(false);
  readonly projectStatusLoadingIds = signal<Set<number>>(new Set());
  @ViewChild('createProjectDialog')
  createProjectDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form!: FormGroup;
  editForm!: FormGroup;
  locationForm!: FormGroup;
  assignLocationForm!: FormGroup;
  assignAdminForm!: FormGroup;

  // Search controls
  projectSearch = new FormControl('');
  statusFilter = new FormControl<ProjectStatusFilter>('ALL');

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  options: AnimationOptions = { path: '/loading.json' };
  isLoadingLocations$ = new BehaviorSubject<boolean>(false);
  targetProject: ProjectWithLocations | null = null;
  selectedProjectDetails: ProjectWithLocations | null = null;
  readonly selectedProjectAdminsState$ = new BehaviorSubject<{ loading: boolean; items: any[] }>({
    loading: false,
    items: [],
  });
  readonly selectedProjectLocationsState$ = new BehaviorSubject<{ loading: boolean; items: LocationModel[] }>({
    loading: false,
    items: [],
  });
  readonly availableLocations = signal<LocationModel[]>([]);
  readonly states = signal<any[]>([]);

  readonly stateOptions = computed<ZardComboboxOption[]>(() =>
    this.states().map((s) => ({
      label: s.name,
      value: String(s.id),
    }))
  );

  readonly locationOptions = computed<ZardComboboxOption[]>(() =>
    this.availableLocations().map((l) => ({
      label: `${l.locationCode} - ${this.formatFullAddress(l)}${l.project?.name ? ' (' + l.project?.name + ')' : ''}`,
      value: String(l.id),
    })),
  );

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  // refresh trigger stream
  private refresh$ = new Subject<void>();

  admins$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins') as Observable<any[]>),
    map((admins) =>
      (admins || []).filter((a) => {
        const raw = (a as any)?.status;
        if (raw == null) return true;
        return raw.toString().toUpperCase() === 'ACTIVE';
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  adminSearchInput = new FormControl('');
  adminOptions$!: Observable<ZardComboboxOption[]>;

  filteredAdmins$: Observable<any[]> = combineLatest([
    this.admins$,
    this.adminSearchInput.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([admins, search]) => {
      if (!search) return admins;
      const lower = search.toLowerCase();
      return admins.filter((a) => {
        const name = (a?.name || '').toString().toLowerCase();
        const email = (a?.email || '').toString().toLowerCase();
        return name.includes(lower) || email.includes(lower);
      });
    })
  );

  // server-side search stream
  projects$: Observable<ProjectWithLocations[]> = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.projectSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    ),
    this.statusFilter.valueChanges.pipe(startWith('ALL' as ProjectStatusFilter), distinctUntilChanged()),
  ]).pipe(
    tap(() => this.goToPage(1)),
    switchMap(([_, query, status]) =>
      this.projectService.findAll(query || '', status ?? 'ALL').pipe(
        map((projects) => {
          const s = (status ?? 'ALL').toString().toUpperCase();
          if (s === 'ALL') return projects ?? [];
          return (projects ?? []).filter((p) => (p?.status ?? '').toString().toUpperCase() === s);
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  pager$: Observable<ProjectPagerVm> = combineLatest([this.projects$, this.page$]).pipe(
    map(([projects, page]) => {
      const sorted = this.sortByMostRecent(projects);
      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);

      const startIndex = (safePage - 1) * this.pageSize;
      const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
      const items = sorted.slice(startIndex, endIndexExclusive);

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

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private projectService: ProjectsService,
    private dialog: ZardDialogService,
    private injector: Injector,
  ) {
    const projectNamePattern = /^[a-zA-Z][a-zA-Z0-9\s]*$/;

    this.form = this.fb.group({
      projectCode: [{ value: '', disabled: true }],
      name: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(projectNamePattern)]],
      description: [''],
    });
    this.editForm = this.fb.group({
      projectCode: [''],
      name: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(projectNamePattern)]],
      description: [''],
    });

    this.locationForm = this.fb.group({
      stateId: ['', [Validators.required]],
      allIndia: [false],
    });

    // Handle allIndia toggle
    this.locationForm.get('allIndia')?.valueChanges.pipe(takeUntilDestroyed()).subscribe(allIndia => {
      const stateIdCtrl = this.locationForm.get('stateId');

      if (allIndia) {
        stateIdCtrl?.disable();
        stateIdCtrl?.clearValidators();
      } else {
        stateIdCtrl?.enable();
        stateIdCtrl?.setValidators([Validators.required]);
      }
      stateIdCtrl?.updateValueAndValidity();
    });

    this.assignLocationForm = this.fb.group({
      locationId: [''],
    });

    this.assignAdminForm = this.fb.group({
      adminId: [''],
    });

    this.adminOptions$ = this.admins$.pipe(
      map((admins) =>
        admins.map((a) => ({
          label: `${a.name} (${a.email})`,
          value: String(a.id),
        })),
      ),
    );

    this.loadStates();
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

  private sortByMostRecent(projects: ProjectWithLocations[]) {
    const items = [...projects];
    items.sort((a, b) => {
      const createdDelta = this.getCreatedAtMs(b) - this.getCreatedAtMs(a);
      if (createdDelta !== 0) return createdDelta;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    return items;
  }

  private getCreatedAtMs(project: ProjectWithLocations) {
    const createdAt = project.createdAt;
    if (!createdAt) return 0;
    const ms = Date.parse(createdAt);
    return Number.isFinite(ms) ? ms : 0;
  }

  // =============================
  // CREATE PROJECT DIALOG
  // =============================

  openCreateDialog() {
    this.resetCreateForm('PR01');
    this.createProjectLoading.set(false);
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Project',
      zContent: this.createProjectDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',
      zOkLoading: this.createProjectLoading,

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => {
        this.createProjectLoading.set(false);
        this.resetCreateForm();
      },
    });

    this.populateNextProjectCode();
  }

  private resetCreateForm(fallbackCode?: string): void {
    this.form.reset({
      projectCode: { value: fallbackCode ?? '', disabled: true },
      name: '',
      description: '',
    });
  }

  private populateNextProjectCode(): void {
    this.projectService
      .findAll('')
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects) => {
          const nextCode = this.getNextProjectCode(projects);
          this.form.get('projectCode')?.setValue(nextCode, { emitEvent: false });
        },
        error: () => {
        },
      });
  }

  private getNextProjectCode(projects: Project[]): string {
    const codes = (projects ?? []).map((p) => p?.projectCode);
    return this.nextSerialCode('PR', codes, 2);
  }

  private nextSerialCode(prefix: string, codes: Array<string | null | undefined>, minDigits: number): string {
    const safePrefix = (prefix ?? '')
      .toString()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .padEnd(2, 'P')
      .slice(0, 2);

    const safeMinDigits = Math.max(2, Math.floor(Number(minDigits) || 2));
    let maxValue = 0;
    let digitsWidth = safeMinDigits;

    for (const raw of codes) {
      const code = (raw ?? '').toString().trim().toUpperCase();
      const match = code.match(/^([A-Z]{2})(\d+)$/);
      if (!match) continue;
      if (match[1] !== safePrefix) continue;

      digitsWidth = Math.max(digitsWidth, match[2].length);

      const value = Number(match[2]);
      if (!Number.isFinite(value)) continue;
      if (value > maxValue) maxValue = value;
    }

    const nextValue = maxValue + 1;
    const digits = nextValue.toString().padStart(digitsWidth, '0');
    return `${safePrefix}${digits}`;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.createProjectLoading.set(true);
    this.projectService.create(this.form.value).subscribe({
      next: (res: any) => {
        const code = res?.projectCode as string | undefined;
        toast.success(code ? `Project created (Code: ${code})` : 'Project created successfully');
        this.createProjectLoading.set(false);
        this.form.reset();
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';
        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Project code already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';
        this.createProjectLoading.set(false);
        toast.error(msg);
      },
    });
  }

  // =============================
  // EDIT PROJECT DIALOG
  // =============================
  @ViewChild('editProjectDialog') editProjectDialog!: TemplateRef<any>;
  @ViewChild('projectDetailsDialog') projectDetailsDialog!: TemplateRef<any>;

  openEditDialog(project: any) {
    this.editForm.patchValue(project);
    this.updateProjectLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Project',
      zContent: this.editProjectDialog,
      zOkText: 'Update',
      zOkLoading: this.updateProjectLoading,
      zOnOk: () => {
        this.updateProject(project.id);
        return false;
      },
    });
  }

  updateProject(id: number) {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.updateProjectLoading.set(true);
    this.projectService.update(id, this.editForm.value).subscribe({
      next: () => {
        toast.success('Project updated');
        this.updateProjectLoading.set(false);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';
        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Project code already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';
        this.updateProjectLoading.set(false);
        toast.error(msg);
      },
    });
  }

  openProjectDetails(project: ProjectWithLocations) {
    const projectId = Number(project?.id);
    this.selectedProjectDetails = project;
    this.selectedProjectAdminsState$.next({ loading: true, items: [] });
    this.selectedProjectLocationsState$.next({ loading: true, items: [] });

    this.dialogRef = this.dialog.create({
      zTitle: `Project Details`,
      zContent: this.projectDetailsDialog,
      zOkText: 'Close',
      zCancelText: null,
      zWidth: '500px',
      zOnOk: () => {
        this.selectedProjectDetails = null;
        this.resetProjectDetailsState();
      },
      zOnCancel: () => {
        this.selectedProjectDetails = null;
        this.resetProjectDetailsState();
      },
    });

    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        if (!Number.isFinite(projectId) || Number(this.selectedProjectDetails?.id) !== projectId) return;
        this.loadSelectedProjectAdmins(projectId);
        this.loadSelectedProjectStates(projectId);
      });
    });

    this.loadStates();
  }

  private loadStates() {
    this.api.get('locations/states').subscribe({
      next: (res: any) => this.states.set(res || []),
      error: () => toast.error('Failed to load states'),
    });
  }

  private resetProjectDetailsState() {
    this.selectedProjectAdminsState$.next({ loading: false, items: [] });
    this.selectedProjectLocationsState$.next({ loading: false, items: [] });
  }

  private loadSelectedProjectAdmins(projectId: number) {
    this.admins$.pipe(take(1)).subscribe({
      next: (admins) => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        const list = Array.isArray(admins) ? admins : [];
        this.resolveAssignedAdmins(projectId, list).subscribe({
          next: (assignedAdmins) => {
            if (Number(this.selectedProjectDetails?.id) !== projectId) return;
            this.selectedProjectAdminsState$.next({ loading: false, items: assignedAdmins });
          },
          error: () => {
            if (Number(this.selectedProjectDetails?.id) !== projectId) return;
            this.selectedProjectAdminsState$.next({ loading: false, items: [] });
          },
        });
      },
      error: () => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        this.selectedProjectAdminsState$.next({ loading: false, items: [] });
      },
    });
  }

  private loadSelectedProjectStates(projectId: number) {
    this.api.get(`locations/project/${projectId}/states`).subscribe({
      next: (states: any) => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        const list = Array.isArray(states) ? states : [];
        this.selectedProjectLocationsState$.next({ 
          loading: false, 
          items: list.map((s: any) => ({ ...s, locationCode: 'STATE', state: s })) 
        });
      },
      error: () => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        this.selectedProjectLocationsState$.next({ loading: false, items: [] });
      },
    });
  }

  private resolveAssignedAdmins(projectId: number, admins: any[]): Observable<any[]> {
    const requests = admins
      .map((admin) => {
        const adminId = Number(admin?.id);
        if (!Number.isFinite(adminId)) return null;

        return this.projectService.findAssignedToUser(adminId).pipe(
          map((projects) => {
            const assigned = Array.isArray(projects) && projects.some((p) => Number(p?.id) === projectId);
            return assigned ? admin : null;
          }),
          catchError(() => of(null)),
        );
      })
      .filter(Boolean) as Observable<any | null>[];

    if (!requests.length) return of([]);

    return forkJoin(requests).pipe(
      map((results) => {
        const uniqueById = new Map<number, any>();
        for (const admin of results) {
          if (admin && !uniqueById.has(admin.id)) uniqueById.set(admin.id, admin);
        }
        return [...uniqueById.values()];
      }),
      catchError(() => of([])),
    );
  }

  formatAdminNames(admins: any[] | null | undefined) {
    const list = Array.isArray(admins) ? admins : [];
    if (!list.length) return '-';
    return list.map((a) => a?.name || a?.email || '').filter(Boolean).join(', ') || '-';
  }

  isProjectStatusLoading(projectId: number): boolean {
    return this.projectStatusLoadingIds().has(projectId);
  }

  private setProjectStatusLoading(projectId: number, loading: boolean): void {
    const next = new Set(this.projectStatusLoadingIds());
    if (loading) next.add(projectId);
    else next.delete(projectId);
    this.projectStatusLoadingIds.set(next);
  }

  toggleProjectStatus(project: Project) {
    if (this.isProjectStatusLoading(project.id)) return;
    const status = project.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.setProjectStatusLoading(project.id, true);
    this.projectService.updateStatus(project.id, status).subscribe({
      next: () => {
        toast.success(status === 'ACTIVE' ? 'Project activated' : 'Project deactivated');
        this.refresh$.next();
        this.setProjectStatusLoading(project.id, false);
      },
      error: () => {
        this.setProjectStatusLoading(project.id, false);
        toast.error('Failed to update status');
      },
    });
  }

  @ViewChild('assignAdminDialog') assignAdminDialog!: TemplateRef<any>;

  openAssignAdminDialog(project: ProjectWithLocations) {
    this.targetProject = project;
    this.assignAdminForm.reset();
    this.adminSearchInput.reset();
    this.dialogRef = this.dialog.create({
      zTitle: `Assign Admin`,
      zContent: this.assignAdminDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.assignAdminLoading,
      zOnOk: () => {
        this.assignAdminToProject();
        return false;
      },
    });
  }

  assignAdminToProject() {
    if (!this.targetProject) return;
    const { adminId } = this.assignAdminForm.value;
    if (!adminId) {
      toast.error('Please select an admin');
      return;
    }
    this.assignAdminLoading.set(true);
    this.api.post('users/assign-project-location', {
      userId: Number(adminId),
      projectId: this.targetProject.id,
    }).subscribe({
      next: () => {
        toast.success('Admin assigned successfully');
        this.assignAdminLoading.set(false);
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: () => {
        this.assignAdminLoading.set(false);
        toast.error('Failed to assign admin');
      },
    });
  }

  @ViewChild('createLocationDialog') createLocationDialog!: TemplateRef<any>;

  openCreateLocationDialog(project: Project) {
    this.targetProject = project;
    this.locationForm.reset({ allIndia: false });
    this.createLocationLoading.set(false);
    this.dialogRef = this.dialog.create({
      zTitle: `Assign State to ${project.name}`,
      zContent: this.createLocationDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.createLocationLoading,
      zOnOk: () => {
        this.submitLocation();
        return false;
      },
    });
  }

  submitLocation() {
    if (!this.targetProject) return;
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }
    this.createLocationLoading.set(true);
    const { stateId, allIndia } = this.locationForm.getRawValue();

    if (allIndia) {
      this.api.post('locations/bulk-all-india', { projectId: this.targetProject.id }).subscribe({
        next: (res: any) => {
          toast.success(res?.message || 'All states mapped successfully');
          this.finishLocationSubmission();
        },
        error: () => {
          this.createLocationLoading.set(false);
          toast.error('Failed to map all states');
        }
      });
      return;
    }

    const payload = {
      projectId: this.targetProject.id,
      stateIds: [Number(stateId)],
    };

    this.api.post('locations/project-states', payload).subscribe({
      next: () => {
        toast.success('State assigned successfully');
        this.finishLocationSubmission();
      },
      error: () => {
        this.createLocationLoading.set(false);
        toast.error('Failed to assign state');
      },
    });
  }

  private finishLocationSubmission() {
    this.createLocationLoading.set(false);
    this.locationForm.reset({ allIndia: false });
    this.targetProject = null;
    this.refresh$.next();
    this.dialogRef?.close();
  }

  getProjectErrorMessage(f: FormGroup): string {
    const control = f.get('name');
    if (!control || !(control.dirty || control.touched) || control.valid) return '';
    if (control.hasError('required')) return 'Name is required';
    return '';
  }

  getLocationErrorMessage(controlName: string): string {
    const control = this.locationForm.get(controlName);
    if (!control || !(control.dirty || control.touched) || control.valid) return '';
    return 'Required';
  }

  getLocationDisplayName(l: any): string {
    if (!l) return '-';
    return (l.village || l.block || l.district?.name || l.district || l.state?.name || l.state || '-').toString();
  }

  formatFullAddress(l?: any): string {
    if (!l) return '-';
    const parts = [l.village, l.block, l.district?.name || l.district, l.state?.name || l.state]
      .map(p => (p || '').toString().trim()).filter(Boolean);
    return parts.join(', ') || '-';
  }

  getLocationDisplayNameTemplate(l: any): string {
    return `<span class="truncate max-w-[180px]">${this.getLocationDisplayName(l)}</span>`;
  }
}
