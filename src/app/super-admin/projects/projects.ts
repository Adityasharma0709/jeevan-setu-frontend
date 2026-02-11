import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, map, combineLatest, of, tap, forkJoin } from 'rxjs';
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

  // ✅ Search controls
  projectSearch = new FormControl('');
  adminSearch = new FormControl('');

  isAssigning = false;
  targetAdmin: any | null = null;

  // ✅ refresh trigger stream
  private refresh$ = new Subject<void>();

  // ✅ server-side search stream
  projects$: Observable<Project[]> = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.projectSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged()
    )
  ]).pipe(
    switchMap(([_, query]) => this.projectService.findAll(query || ''))
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
    this.projectService.update(id, this.editForm.value).subscribe(() => {
      toast.success('Project updated');
      this.refresh$.next();
      this.dialogRef.close();
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

}
