import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, map, combineLatest, of, forkJoin, BehaviorSubject, shareReplay, tap } from 'rxjs';
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
  @ViewChild('createProjectDialog')
  createProjectDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form!: FormGroup;
  editForm!: FormGroup;
  locationForm!: FormGroup;
  assignLocationForm!: FormGroup;
  assignAdminForm!: FormGroup;

  // ✅ Search controls
  projectSearch = new FormControl('');
  options: AnimationOptions = { path: '/loading.json' };
  isLoadingLocations$ = new BehaviorSubject<boolean>(false);
  targetProject: ProjectWithLocations | null = null;
  selectedProjectDetails: ProjectWithLocations | null = null;
  availableLocations: LocationModel[] = [];

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);

  // ✅ refresh trigger stream
  private refresh$ = new Subject<void>();

  admins$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins') as Observable<any[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ✅ server-side search stream
  projects$: Observable<ProjectWithLocations[]> = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.projectSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    )
  ]).pipe(
    tap(() => this.goToPage(1)),
    switchMap(([_, query]) => this.projectService.findAll(query || '').pipe(
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
      locationId: [''],
    });
  }

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
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
    this.form.reset();
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Project',
      zContent: this.createProjectDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => {
        this.form.reset();
      },
    });
  }

  submit() {
    this.projectService.create(this.form.value).subscribe({
      next: (res: any) => {
        const code = res?.projectCode as string | undefined;
        toast.success(code ? `Project created (Code: ${code})` : 'Project created successfully');

        this.form.reset();

        // ✅ trigger refresh safely
        this.refresh$.next();

        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';

        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Project code already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';

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

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Project',
      zContent: this.editProjectDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.updateProject(project.id);
        return false;
      },
    });
  }

  updateProject(id: number) {
    this.projectService.update(id, this.editForm.value).subscribe({
      next: () => {
        toast.success('Project updated');
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';

        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Project code already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';

        toast.error(msg);
      },
    });
  }

  openProjectDetails(project: ProjectWithLocations) {
    this.selectedProjectDetails = project;

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
  // =============================
  // STATUS TOGGLE
  // =============================

  toggleProjectStatus(project: Project) {
    const status = project.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.projectService.updateStatus(project.id, status).subscribe({
      next: () => {
        toast.success(status === 'ACTIVE' ? 'Project activated' : 'Project deactivated');

        // ✅ safe refresh
        this.refresh$.next();
      },
      error: () => toast.error('Failed to update status'),
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

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Admin to ${project.name}`,
      zContent: this.assignAdminDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '450px',

      zOnOk: () => {
        this.assignAdminToProject();
        return false;
      },

      zOnCancel: () => {
        this.targetProject = null;
        this.assignAdminForm.reset();
      },
    });
  }

  assignAdminToProject() {
    if (!this.targetProject) {
      toast.error('No project selected');
      return;
    }

    const { adminId, locationId } = this.assignAdminForm.value;

    if (!adminId) {
      toast.error('Please select an admin');
      return;
    }

    if (!locationId) {
      toast.error('Please select a location');
      return;
    }

    this.api.post('users/assign-project-location', {
      userId: Number(adminId),
      projectId: Number(this.targetProject.id),
      locationId: Number(locationId),
    }).subscribe({
      next: () => {
        toast.success('Admin assigned successfully');
        this.assignAdminForm.reset();
        this.targetProject = null;
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: () => toast.error('Failed to assign admin'),
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

      zOnOk: () => {
        this.assignExistingLocation();
        return false;
      },
      zOnCancel: () => {
        this.targetProject = null;
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
        this.assignLocationForm.reset();
        this.targetProject = null;
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: () => toast.error('Failed to assign location'),
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

    this.dialogRef = this.dialog.create({
      zTitle: `Add Location to ${project.name}`,
      zContent: this.createLocationDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '450px',

      zOnOk: () => {
        this.submitLocation();
        return false;
      },
      zOnCancel: () => {
        this.targetProject = null;
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

    if (!locationCode || !state || !district || !block || !village) {
      toast.error('Please fill all location fields');
      return;
    }

    this.api.post('locations', {
      projectId: this.targetProject.id,
      locationCode,
      state,
      district,
      block,
      village,
    }).subscribe({
      next: () => {
        toast.success('Location created successfully');
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

