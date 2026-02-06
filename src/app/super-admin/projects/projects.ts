import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
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
import { ZardFormControlComponent, ZardFormFieldComponent } from "@/shared/components/form";

interface Project {
  id: number;
  projectCode: string;
  name: string;
  status: string;
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
    ZardFormFieldComponent
],
  templateUrl: './projects.html',
})
export class ProjectsComponent {
  @ViewChild('createProjectDialog')
  createProjectDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form!: FormGroup;
  projects$!: Observable<Project[]>;

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService,
  ) {
    this.form = this.fb.group({
      projectCode: [''],
      name: [''],
      description: ['']
    });

    this.projects$ = this.api.get('projects') as Observable<Project[]>;
  }

  openCreateDialog() {
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Project',
      zContent: this.createProjectDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',

      zOnOk: () => {
        this.submit();
        return false; // prevent auto close
      },

      zOnCancel: () => {
        this.form.reset();
      },
    });
  }

  submit() {
    this.api.post('projects', this.form.value).subscribe({
      next: () => {
        toast.success('Project created successfully');
        this.form.reset();
        this.projects$ = this.api.get('projects') as Observable<Project[]>;

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
  toggleProjectStatus(project: any) {
    const status = project.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.api.patch(`projects/${project.id}/status`, { status }).subscribe({
      next: () => {
        toast.success(status === 'ACTIVE' ? 'Project activated' : 'Project deactivated');

        this.projects$ = this.api.get('projects')as Observable<Project[]>;
      },
      error: () => toast.error('Failed to update status'),
    });
  }
}
