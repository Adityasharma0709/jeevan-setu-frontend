import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, map, combineLatest, of, forkJoin, BehaviorSubject, shareReplay, tap, take } from 'rxjs';
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
  selectedProjectAdmins: any[] | null = null;
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
    shareReplay({ bufferSize: 1, refCount: true }),
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
    switchMap(([_, query, status]) => this.projectService.findAll(query || '', status ?? 'ALL').pipe(
      map((projects) => {
        const s = (status ?? 'ALL').toString().toUpperCase();
        if (s === 'ALL') return projects;
        return (projects ?? []).filter((p) => (p?.status ?? '').toString().toUpperCase() === s);
      }),
      switchMap((projects) => {
        if (!projects.length) return of([]);

        const locationCalls = projects.map((p) =>
          this.api.get(`locations?projectId=${p.id}`) as Observable<LocationModel[]>
        );

        return forkJoin(locationCalls).pipe(
          map((locationsByProject) =>
            projects.map((p, index) => ({
              ...p,
              locations: locationsByProject[index] || [],
            }))
          )
        );
      })
    ))
    ,
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
  ) {
    this.form = this.fb.group({
      projectCode: [{ value: '', disabled: true }],
      name: [''],
      description: [''],
    });
    this.editForm = this.fb.group({
      projectCode: [''],
      name: [''],
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
    this.selectedProjectDetails = project;
    this.selectedProjectAdmins = null;

    this.admins$.pipe(take(1)).subscribe({
      next: (admins) => {
        const projectId = Number(project?.id);
        const list = Array.isArray(admins) ? admins : [];

        const assigned = list.filter((a) => this.isUserAssignedToProject(a, projectId));
        const uniqueById = new Map<number, any>();
        for (const a of assigned) {
          const id = Number(a?.id);
          if (Number.isFinite(id) && !uniqueById.has(id)) uniqueById.set(id, a);
        }

        const computed = [...uniqueById.values()];
        setTimeout(() => {
          if (Number(this.selectedProjectDetails?.id) !== projectId) return;
          this.selectedProjectAdmins = computed;
        }, 0);
      },
      error: () => {
        setTimeout(() => {
          if (Number(this.selectedProjectDetails?.id) !== Number(project?.id)) return;
          this.selectedProjectAdmins = [];
        }, 0);
      },
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Project Details: ${project.name}`,
      zContent: this.projectDetailsDialog,
      zOkText: 'Close',
      zWidth: '500px',
      zOnOk: () => {
        this.selectedProjectDetails = null;
      },
      zOnCancel: () => {
        this.selectedProjectDetails = null;
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
    this.targetProject = project;
    this.assignAdminForm.reset();
    this.assignAdminLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Admin to ${project.name}`,
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
      },
    });
  }

  assignAdminToProject() {
    if (!this.targetProject) {
      toast.error('No project selected');
      return;
    }

    const { adminId } = this.assignAdminForm.value;

    if (!adminId) {
      toast.error('Please select an admin');
      return;
    }

    const locations = this.targetProject.locations ?? [];
    if (!locations.length) {
      toast.error('No locations assigned to this project');
      return;
    }

    this.assignAdminLoading.set(true);
    this.api.post('users/assign-project-location', {
      userId: Number(adminId),
      projectId: Number(this.targetProject.id),
      locationId: Number(locations[0].id),
    }).subscribe({
      next: () => {
        toast.success('Admin assigned successfully');
        this.assignAdminLoading.set(false);
        this.assignAdminForm.reset();
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
  }

  // =============================
  // ASSIGN EXISTING LOCATION TO PROJECT
  // =============================

  @ViewChild('assignLocationDialog')
  assignLocationDialog!: TemplateRef<any>;

  openAssignLocationDialog(project: Project) {
    this.targetProject = project;
    this.assignLocationForm.reset();
    this.availableLocations = [];
    this.isLoadingLocations$.next(true);
    this.assignLocationLoading.set(false);

    this.api.get('locations').subscribe({
      next: (locations: any) => {
        this.availableLocations = Array.isArray(locations) ? locations : [];
        this.isLoadingLocations$.next(false);
      },
      error: () => {
        this.availableLocations = [];
        this.isLoadingLocations$.next(false);
        toast.error('Failed to load locations');
      },
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Location to ${project.name}`,
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
    if (!locations || !locations.length) return '-';
    return locations.map(l => l.locationCode).join(', ');
  }

  getLocationCount(locations?: LocationModel[]) {
    return locations?.length ?? 0;
  }

}



