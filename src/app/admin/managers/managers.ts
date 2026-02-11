import { Component, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { Observable, Subject, startWith, switchMap, combineLatest, debounceTime, distinctUntilChanged, tap, of } from 'rxjs';
import { toast } from 'ngx-sonner';

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
    ZardIconComponent
  ],
  templateUrl: './managers.html',
  styleUrl: './managers.css',
})
export class Managers {
  @ViewChild('managerDialog') managerDialog!: TemplateRef<any>;
  @ViewChild('assignDialog') assignDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  managerForm!: FormGroup;
  assignForm!: FormGroup;
  searchControl = new FormControl('');

  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedManagerId: number | null = null;
  targetManager: User | null = null;

  managers$!: Observable<User[]>;
  projects$!: Observable<any[]>;
  locations$!: Observable<any[]>;

  constructor(
    private fb: FormBuilder,
    private managersService: ManagersService,
    private dialog: ZardDialogService
  ) {
    this.managers$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      switchMap(([_, query]) => this.managersService.findAll(query || ''))
    );

    this.projects$ = this.managersService.getProjects();
    this.initForms();
  }

  private initForms() {
    this.managerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Only required during creation
    });

    this.assignForm = this.fb.group({
      projectId: ['', Validators.required],
      locationId: ['', Validators.required],
    });

    this.locations$ = this.assignForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.assignForm.patchValue({ locationId: '' })),
      switchMap(id => (id ? this.managersService.getLocations(id) : of([])))
    );
  }

  openCreateDialog() {
    this.isEditing = false;
    this.managerForm.reset();
    this.managerForm.get('password')?.setValidators(Validators.required);

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
    this.isEditing = true;
    this.selectedManagerId = manager.id;
    this.managerForm.patchValue(manager);
    this.managerForm.get('password')?.clearValidators();
    this.managerForm.get('password')?.updateValueAndValidity();

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
      toast.error('Please fill all required fields correctly');
      return;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.managersService.update(this.selectedManagerId!, this.managerForm.value)
      : this.managersService.create(this.managerForm.value);

    obs.subscribe({
      next: () => {
        toast.success(`Manager ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err.error?.message || 'Something went wrong');
        this.isSubmitting = false;
      }
    });
  }

  openAssignDialog(manager: User) {
    this.targetManager = manager;
    this.assignForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Project to ${manager.name}`,
      zContent: this.assignDialog,
      zOkText: 'Assign',
      zOnOk: () => {
        this.submitAssignment();
        return false;
      },
    });
  }

  submitAssignment() {
    if (this.assignForm.invalid) {
      toast.error('Please select both project and location');
      return;
    }

    this.isSubmitting = true;
    const { projectId, locationId } = this.assignForm.value;

    this.managersService.assignProject(this.targetManager!.id, Number(projectId), Number(locationId)).subscribe({
      next: () => {
        toast.success('Project assigned successfully');
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err.error?.message || 'Assignment failed');
        this.isSubmitting = false;
      }
    });
  }
}
