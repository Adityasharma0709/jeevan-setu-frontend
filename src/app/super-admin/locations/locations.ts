import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { toast } from 'ngx-sonner';
import { ZardDividerComponent } from '@/shared/components/divider';
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';
import { ZardMenuImports } from '@/shared/components/menu';
import { ApiService } from '../../core/services/api';
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
import { ZardFormFieldComponent, ZardFormControlComponent } from "@/shared/components/form";
@Component({
  selector: 'app-locations',
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
    ZardDividerComponent,
    ZardDropdownImports,
    ZardMenuImports,
    ZardDropdownDirective,
    ZardDropdownMenuComponent,
    ZardIconComponent,
    ZardFormFieldComponent,
    ZardFormControlComponent
],
  templateUrl: './locations.html'
})
export class LocationsComponent {

  @ViewChild('createLocationDialog')
  createLocationDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form!: FormGroup;
  locations$!: Observable<any>;
  projects$!: Observable<any>;   // 👈 for dropdown
selectedProjectName = '';

selectProject(project: any) {
  this.form.patchValue({ projectId: project.id });
  this.selectedProjectName = project.name;
}

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
      village: ['']
    });

    this.locations$ = this.api.get('locations');
    this.projects$ = this.api.get('projects'); // 👈 fetch projects
    
  }

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

      zOnCancel: () => {
        this.form.reset();
      }
    });
  }

  submit() {
    this.api.post('locations', this.form.value)
      .subscribe({
        next: () => {
          toast.success('Location created successfully');
          this.form.reset();
          this.locations$ = this.api.get('locations');
          this.dialogRef?.close();
        },
        error: (err) => {
          let msg = 'Something went wrong';

          if (err.status === 400) msg = err.error?.message || 'Bad Request';
          else if (err.status === 409) msg = 'Location code already exists';
          else if (err.status === 401) msg = 'Session expired. Login again';
          else if (err.status === 500) msg = 'Server error. Try later';

          toast.error(msg);
        }
      });
  }

toggleLocationStatus(location: any) {
  const status =
    location.status === 'ACTIVE'
      ? 'INACTIVE'
      : 'ACTIVE';

  this.api.patch(`locations/${location.id}/status`, { status })
    .subscribe(() => {
      toast.success(
        status === 'ACTIVE'
          ? 'Location activated'
          : 'Location deactivated'
      );

      this.locations$ = this.api.get('locations');
    });
}

}
