import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
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
import { ZardIconComponent } from '@/shared/components/icon';

import { ProjectsService, Project } from './projects.service';

interface LocationModel {
  id: number;
  projectId: number | null;
  locationCode: string;
  state: string;
  district: string;
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

  // âœ… Search controls
  projectSearch = new FormControl('');
  statusFilter = new FormControl<ProjectStatusFilter>('ALL');
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
  availableLocations: LocationModel[] = [];

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  // âœ… refresh trigger stream
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

  // âœ… server-side search stream
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
    this.form = this.fb.group({
      projectCode: [{ value: '', disabled: true }],
      name: ['', [Validators.required, Validators.maxLength(50)]],
      description: [''],
    });
    this.editForm = this.fb.group({
      projectCode: [''],
      name: ['', [Validators.required, Validators.maxLength(50)]],
      description: [''],
    });

    this.locationForm = this.fb.group({
      locationCode: [''],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.assignLocationForm = this.fb.group({
      locationId: [''],
    });

    this.assignAdminForm = this.fb.group({
      adminId: [''],
    });
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
          // keep fallback code if fetch fails
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
    this.createProjectLoading.set(true);
    this.projectService.create(this.form.value).subscribe({
      next: (res: any) => {
        const code = res?.projectCode as string | undefined;
        toast.success(code ? `Project created (Code: ${code})` : 'Project created successfully');
        this.createProjectLoading.set(false);

        this.form.reset();

        // âœ… trigger refresh safely
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
  @ViewChild('editProjectDialog')
  editProjectDialog!: TemplateRef<any>;
  @ViewChild('projectDetailsDialog')
  projectDetailsDialog!: TemplateRef<any>;

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
        this.loadSelectedProjectLocations(projectId);
      });
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

  private loadSelectedProjectLocations(projectId: number) {
    (this.api.get(`locations?projectId=${projectId}`) as Observable<LocationModel[]>).subscribe({
      next: (locations) => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        const list = Array.isArray(locations) ? locations : [];
        const items = list.filter((l: any) => {
          const raw = (l as any)?.status;
          if (raw == null) return true;
          return raw.toString().toUpperCase() === 'ACTIVE';
        });
        this.selectedProjectLocationsState$.next({ loading: false, items });
      },
      error: () => {
        if (Number(this.selectedProjectDetails?.id) !== projectId) return;
        this.selectedProjectLocationsState$.next({ loading: false, items: [] });
      },
    });
  }

  private isUserAssignedToProject(user: any, projectId: number) {
    if (!Number.isFinite(projectId)) return false;

    const directProjectId = Number(user?.projectId);
    if (Number.isFinite(directProjectId) && directProjectId === projectId) return true;

    const nestedProjectId = Number(user?.project?.id);
    if (Number.isFinite(nestedProjectId) && nestedProjectId === projectId) return true;

    const maybeProjects = user?.projects;
    if (Array.isArray(maybeProjects)) {
      return maybeProjects.some((p: any) => {
        const id = Number(p?.id ?? p?.projectId);
        return Number.isFinite(id) && id === projectId;
      });
    }

    const maybeAssignments = user?.assignments;
    if (Array.isArray(maybeAssignments)) {
      return maybeAssignments.some((a: any) => {
        const id = Number(a?.projectId ?? a?.project?.id);
        return Number.isFinite(id) && id === projectId;
      });
    }

    return false;
  }

  private resolveAssignedAdmins(projectId: number, admins: any[]): Observable<any[]> {
    const directlyAssigned = this.getUniqueAdmins(admins.filter((a) => this.isUserAssignedToProject(a, projectId)));
    if (directlyAssigned.length) {
      return of(directlyAssigned);
    }

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

    if (!requests.length) {
      return of([]);
    }

    return forkJoin(requests).pipe(
      map((results) => this.getUniqueAdmins(results.filter(Boolean))),
      catchError(() => of([])),
    );
  }

  private getUniqueAdmins(admins: any[]): any[] {
    const uniqueById = new Map<number, any>();
    for (const admin of admins) {
      const adminId = Number(admin?.id);
      if (Number.isFinite(adminId) && !uniqueById.has(adminId)) {
        uniqueById.set(adminId, admin);
      }
    }
    return [...uniqueById.values()];
  }

  formatAdminNames(admins: any[] | null | undefined) {
    const list = Array.isArray(admins) ? admins : [];
    if (!list.length) return '-';
    return list
      .map((a) => (a?.name || a?.email || '').toString().trim())
      .filter(Boolean)
      .join(', ') || '-';
  }
  // =============================
  // STATUS TOGGLE
  // =============================

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

        // âœ… safe refresh
        this.refresh$.next();
        this.setProjectStatusLoading(project.id, false);
      },
      error: () => {
        this.setProjectStatusLoading(project.id, false);
        toast.error('Failed to update status');
      },
    });
  }

  // =============================
  // DISABLE PROJECT
  // =============================

  disableProject(id: number) {
    if (!confirm('Are you sure you want to disable this project?')) return;

    this.projectService.disable(id).subscribe({
      next: () => {
        toast.success('Project disabled');
        this.refresh$.next();
      },
      error: () => toast.error('Failed to disable project'),
    });
  }

  // =============================
  // ASSIGN ADMIN TO PROJECT
  // =============================

  @ViewChild('assignAdminDialog')
  assignAdminDialog!: TemplateRef<any>;

  openAssignAdminDialog(project: ProjectWithLocations) {
    const projectStatus = (project as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }
    this.targetProject = project;
    this.assignAdminForm.reset();
    this.adminSearchInput.reset();
    this.assignAdminLoading.set(false);

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

      zOnCancel: () => {
        this.targetProject = null;
        this.assignAdminLoading.set(false);
        this.assignAdminForm.reset();
        this.adminSearchInput.reset();
      },
    });
  }

  assignAdminToProject() {
    if (!this.targetProject) {
      toast.error('No project selected');
      return;
    }

    const projectStatus = (this.targetProject as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }

    const { adminId } = this.assignAdminForm.value;

    if (!adminId) {
      toast.error('Please select an admin');
      return;
    }

    const projectId = Number(this.targetProject.id);
    this.assignAdminLoading.set(true);

    forkJoin({
      admins: this.admins$.pipe(take(1)),
      locations: this.api.get(`locations?projectId=${projectId}`) as Observable<LocationModel[]>,
    }).subscribe({
      next: ({ admins, locations }) => {
        if (!this.targetProject || Number(this.targetProject.id) !== projectId) {
          this.assignAdminLoading.set(false);
          return;
        }

        const adminList = Array.isArray(admins) ? admins : [];
        const selectedAdmin = adminList.find((a) => Number((a as any)?.id) === Number(adminId));
        const adminStatus = (selectedAdmin as any)?.status;
        if (selectedAdmin && adminStatus != null && adminStatus.toString().toUpperCase() !== 'ACTIVE') {
          toast.error('Inactive admins cannot be assigned');
          this.assignAdminLoading.set(false);
          return;
        }

        const locationList = Array.isArray(locations) ? locations : [];
        const activeLocations = locationList.filter((l: any) => {
          const raw = (l as any)?.status;
          if (raw == null) return true;
          return raw.toString().toUpperCase() === 'ACTIVE';
        });
        if (!activeLocations.length) {
          toast.error('No active locations assigned to this project');
          this.assignAdminLoading.set(false);
          return;
        }

        this.api.post('users/assign-project-location', {
          userId: Number(adminId),
          projectId,
          locationId: Number(activeLocations[0].id),
        }).subscribe({
          next: () => {
            toast.success('Admin assigned successfully');
            this.assignAdminLoading.set(false);
            this.assignAdminForm.reset();
            this.adminSearchInput.reset();
            this.targetProject = null;
            this.refresh$.next();
            this.dialogRef?.close();
          },
          error: (err) => {
            this.assignAdminLoading.set(false);
            if (err?.status === 409) {
              toast.info('Already assigned');
              return;
            }
            toast.error('Failed to assign admin');
          },
        });
      },
      error: () => {
        this.assignAdminLoading.set(false);
        toast.error('Failed to validate admin/locations');
      },
    });
  }

  // =============================
  // ASSIGN EXISTING LOCATION TO PROJECT
  // =============================

  @ViewChild('assignLocationDialog')
  assignLocationDialog!: TemplateRef<any>;

  openAssignLocationDialog(project: Project) {
    const projectStatus = (project as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }
    this.targetProject = project;
    this.assignLocationForm.reset();
    this.availableLocations = [];
    this.isLoadingLocations$.next(true);
    this.assignLocationLoading.set(false);

    this.api.get('locations').subscribe({
      next: (locations: any) => {
        const list = Array.isArray(locations) ? locations : [];
        this.availableLocations = list.filter((l: any) => {
          const raw = l?.status;
          if (raw == null) return true;
          if (raw.toString().toUpperCase() !== 'ACTIVE') return false;
          const pid = l?.projectId;
          return pid === null || pid === undefined;
        });
        this.isLoadingLocations$.next(false);
      },
      error: () => {
        this.availableLocations = [];
        this.isLoadingLocations$.next(false);
        toast.error('Failed to load locations');
      },
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Location`,
      zContent: this.assignLocationDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.assignLocationLoading,

      zOnOk: () => {
        this.assignExistingLocation();
        return false;
      },
      zOnCancel: () => {
        this.targetProject = null;
        this.assignLocationLoading.set(false);
        this.assignLocationForm.reset();
      },
    });
  }

  assignExistingLocation() {
    if (!this.targetProject) {
      toast.error('No project selected');
      return;
    }

    const projectStatus = (this.targetProject as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }

    const { locationId } = this.assignLocationForm.value;

    if (!locationId) {
      toast.error('Please select a location');
      return;
    }

    const location = this.availableLocations.find(l => l.id === Number(locationId));

    if (!location) {
      toast.error('Selected location not found');
      return;
    }

    const locationStatus = (location as any)?.status;
    if (locationStatus != null && locationStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive locations cannot be assigned');
      return;
    }

    if (location.projectId === this.targetProject.id) {
      toast.info('Location is already assigned to this project');
      return;
    }

    this.assignLocationLoading.set(true);
    this.api.put(`locations/${location.id}`, {
      projectId: this.targetProject.id,
      locationCode: location.locationCode,
      state: location.state,
      district: location.district,
      block: location.block,
      village: location.village,
    }).subscribe({
      next: () => {
        toast.success('Location assigned successfully');
        this.assignLocationLoading.set(false);
        this.assignLocationForm.reset();
        this.targetProject = null;
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        this.assignLocationLoading.set(false);
        if (err?.status === 409) {
          toast.info('Already assigned');
          return;
        }
        toast.error('Failed to assign location');
      },
    });
  }

  // =============================
  // ADD LOCATION TO PROJECT
  // =============================

  @ViewChild('createLocationDialog')
  createLocationDialog!: TemplateRef<any>;

  openCreateLocationDialog(project: Project) {
    const projectStatus = (project as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }
    this.targetProject = project;
    this.locationForm.reset();
    this.createLocationLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: `Add Location to ${project.name}`,
      zContent: this.createLocationDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.createLocationLoading,

      zOnOk: () => {
        this.submitLocation();
        return false;
      },
      zOnCancel: () => {
        this.targetProject = null;
        this.createLocationLoading.set(false);
        this.locationForm.reset();
      },
    });
  }

  submitLocation() {
    if (!this.targetProject) {
      toast.error('No project selected');
      return;
    }

    const projectStatus = (this.targetProject as any)?.status;
    if (projectStatus != null && projectStatus.toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Inactive projects cannot be assigned');
      return;
    }

    const { locationCode, state, district, block, village } = this.locationForm.value;
    const trimmedCode = (locationCode ?? '').toString().trim();

    if (!state || !district || !block || !village) {
      toast.error('Please fill all location fields');
      return;
    }

    this.createLocationLoading.set(true);
    const payload: any = {
      projectId: this.targetProject.id,
      state,
      district,
      block,
      village,
    };

    if (trimmedCode) {
      payload.locationCode = trimmedCode;
    }

    this.api.post('locations', payload).subscribe({
      next: () => {
        toast.success('Location created successfully');
        this.createLocationLoading.set(false);
        this.locationForm.reset();
        this.targetProject = null;
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';

        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Location code already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';

        this.createLocationLoading.set(false);
        toast.error(msg);
      },
    });
  }

  formatLocationCodes(locations?: LocationModel[]) {
    const list = Array.isArray(locations) ? locations : [];
    if (!list.length) return '-';
    const labels = list
      .map((l) => {
        const code = (l as any)?.locationCode;
        if (code != null && code.toString().trim()) return code.toString().trim();
        const village = (l as any)?.village;
        const block = (l as any)?.block;
        if (village != null && block != null) return `${village} (${block})`.toString().trim();
        if (village != null) return village.toString().trim();
        return '';
      })
      .filter(Boolean);
    return labels.join(', ') || '-';
  }

  getLocationCount(locations?: LocationModel[]) {
    return locations?.length ?? 0;
  }

}



