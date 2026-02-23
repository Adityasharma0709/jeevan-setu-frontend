import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, map, combineLatest, of, tap, forkJoin, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { toast } from 'ngx-sonner';

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
  ],
  templateUrl: './projects.html',
})
export class ProjectsComponent {
  @ViewChild('createProjectDialog')
  createProjectDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form!: FormGroup;
  editForm!: FormGroup;
  assignForm!: FormGroup;
  locationForm!: FormGroup;
  assignLocationForm!: FormGroup;

  // ✅ Search controls
  projectSearch = new FormControl('');
  adminSearch = new FormControl('');

  isAssigning = false;
  isLoadingLocations$ = new BehaviorSubject<boolean>(false);
  targetAdmin: any | null = null;
  targetProject: Project | null = null;
  selectedProjectDetails: ProjectWithLocations | null = null;
  availableLocations: LocationModel[] = [];

  // ✅ refresh trigger stream
  private refresh$ = new Subject<void>();

  // ✅ server-side search stream
  projects$: Observable<ProjectWithLocations[]> = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.projectSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    )
  ]).pipe(
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
  );

  admins$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins') as Observable<any[]>),
  );

  // ✅ Filtered admins (still client-side for now as no change requested for users)
  filteredAdmins$: Observable<any[]> = combineLatest([
    this.admins$,
    this.adminSearch.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([admins, query]) => {
      const q = query?.toLowerCase() || '';
      return admins.filter(a =>
        a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
      );
    })
  );

  locations$!: Observable<any[]>;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private projectService: ProjectsService,
    private dialog: ZardDialogService,
  ) {
    this.form = this.fb.group({
      projectCode: [''],
      name: [''],
      description: [''],
    });
    this.editForm = this.fb.group({
      projectCode: [''],
      name: [''],
      description: [''],
    });

    this.assignForm = this.fb.group({
      projectId: [''],
      locationId: [''],
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

    // Reactive locations logic
    this.locations$ = this.assignForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.assignForm.patchValue({ locationId: '' })),
      switchMap(id => (id ? (this.api.get(`locations?projectId=${id}`) as Observable<any[]>) : of([])))
    );
  }

  // =============================
  // CREATE PROJECT DIALOG
  // =============================

  openCreateDialog() {
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
      next: () => {
        toast.success('Project created successfully');

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

  @ViewChild('assignDialog')
  assignDialog!: TemplateRef<any>;

  openAssignDialog(admin: any) {
    this.targetAdmin = admin;

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Projects to ${admin.name}`,
      zContent: this.assignDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '400px',

      zOnOk: () => {
        this.assignProjects();
        return false;
      },
      zOnCancel: () => {
        this.targetAdmin = null;
        this.assignForm.reset();
      }
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

  assignProjects() {
    const { projectId, locationId } = this.assignForm.value;

    if (!projectId || !locationId) {
      toast.error('Please select both project and location');
      return;
    }

    if (!this.targetAdmin) {
      toast.error('No admin selected');
      return;
    }

    this.isAssigning = true;

    this.api.post('users/assign', {
      userId: this.targetAdmin.id,
      projectId: Number(projectId),
      locationId: Number(locationId),
    }).subscribe({
      next: () => {
        toast.success(`Successfully assigned to ${this.targetAdmin.name}`);
        this.targetAdmin = null;
        this.assignForm.reset();
        this.refresh$.next();
        this.isAssigning = false;
        this.dialogRef?.close();
      },
      error: (err) => {
        console.error('Assignment error:', err);
        const msg = err.error?.message || 'Assignment failed';
        toast.error(typeof msg === 'string' ? msg : 'Assignment failed');
        this.isAssigning = false;
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

