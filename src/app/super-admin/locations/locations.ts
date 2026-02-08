import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { ApiService } from '../../core/services/api';

/* =========================
   ZARD UI IMPORTS
========================= */

import { ZardDividerComponent } from '@/shared/components/divider';
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';
import { ZardMenuImports } from '@/shared/components/menu';
import { ZardIconComponent } from '@/shared/components/icon';
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

import { ZardDropdownDirective, ZardDropdownMenuComponent } from '@/shared/components/dropdown';

import { ZardFormFieldComponent, ZardFormControlComponent } from '@/shared/components/form';

/* =========================
   INTERFACES
========================= */

interface ProjectModel {
  id: number;
  name: string;
}

interface LocationModel {
  id: number;
  projectId: number;
  locationCode: string;
  state: string;
  district: string;
  block: string;
  village: string;
  status: string;
  project?: ProjectModel;
}

/* =========================
   COMPONENT
========================= */

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,

    ZardButtonComponent,
    ZardInputDirective,
    ZardIconComponent,

    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,

    ZardDialogModule,

    ZardDropdownImports,
    ZardMenuImports,
    ZardDropdownDirective,
    ZardDropdownMenuComponent,

    ZardFormFieldComponent,
    ZardFormControlComponent,

    ZardDividerComponent,
  ],
  templateUrl: './locations.html',
})
export class LocationsComponent {

  /* =========================
     TEMPLATE REFERENCES
  ========================= */

  @ViewChild('createLocationDialog') createLocationDialog!: TemplateRef<any>;
  @ViewChild('editLocationDialog') editLocationDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  /* =========================
     FORMS
  ========================= */

  form: FormGroup;
  editForm: FormGroup;

  /* =========================
     DATA STREAMS
  ========================= */

  private refresh$ = new Subject<void>();

  locations$: Observable<LocationModel[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('locations') as Observable<LocationModel[]>)
  );

  projects$: Observable<ProjectModel[]>;

  selectedProjectName = '';

  /* =========================
     CONSTRUCTOR
  ========================= */

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService
  ) {
    this.form = this.fb.group({
      projectId: [''],
      locationCode: [''],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.editForm = this.fb.group({
      projectId: [''],
      locationCode: [''],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.projects$ = this.api.get('projects') as Observable<ProjectModel[]>;
  }

  /* =========================
     PROJECT SELECTION
  ========================= */

  selectProject(project: ProjectModel) {
    this.form.patchValue({ projectId: project.id });
    this.selectedProjectName = project.name;
  }

  /* =========================
     CREATE LOCATION
  ========================= */

  openCreateDialog() {
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Location',
      zContent: this.createLocationDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '450px',

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => this.form.reset(),
    });
  }

  submit() {
    this.api.post('locations', this.form.value).subscribe({
      next: () => {
        toast.success('Location created successfully');
        this.form.reset();
        this.selectedProjectName = '';
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

  /* =========================
     EDIT LOCATION
  ========================= */

  openEditDialog(location: LocationModel) {
    this.editForm.patchValue({
      projectId: location.projectId,
      locationCode: location.locationCode,
      state: location.state,
      district: location.district,
      block: location.block,
      village: location.village,
    });

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Location',
      zContent: this.editLocationDialog,
      zOkText: 'Update',

      zOnOk: () => {
        this.updateLocation(location.id);
        return false;
      },
    });
  }

  updateLocation(id: number) {
    this.api.put(`locations/${id}`, this.editForm.value).subscribe({
      next: () => {
        toast.success('Location updated');
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: () => toast.error('Failed to update location'),
    });
  }

  /* =========================
     STATUS TOGGLE
  ========================= */

  toggleLocationStatus(location: LocationModel) {
    const status = location.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.api.patch(`locations/${location.id}/status`, { status }).subscribe({
      next: () => {
        toast.success(
          status === 'ACTIVE'
            ? 'Location activated'
            : 'Location deactivated'
        );
        this.refresh$.next();
      },
      error: () => toast.error('Failed to update status'),
    });
  }
}
