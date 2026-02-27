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
import { AuthService } from '../../core/services/auth';

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
  isEditing = false;
  selectedManagerId: number | null = null;
  targetManager: User | null = null;

  managers$!: Observable<User[]>;
  projects$!: Observable<any[]>;
  locations$!: Observable<any[]>;
  managerLocations$!: Observable<any[]>;
  private currentUserId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private managersService: ManagersService,
    private dialog: ZardDialogService,
    private authService: AuthService
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

    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;
    this.projects$ = this.managersService.getProjects(currentUser?.sub);
    this.initForms();
  }

  private initForms() {
    this.managerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''], // Only required during creation
      projectId: [''],
      locationId: [''],
    });

    this.assignForm = this.fb.group({
      projectId: ['', Validators.required],
      locationId: ['', Validators.required],
    });

    this.locations$ = this.assignForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.assignForm.patchValue({ locationId: '' })),
      switchMap(id => (id ? this.managersService.getLocations(id) : of([])))
    );

    this.managerLocations$ = this.managerForm.get('projectId')!.valueChanges.pipe(
      tap(() => this.managerForm.patchValue({ locationId: '' })),
      switchMap(id => (id ? this.managersService.getLocations(Number(id)) : of([])))
    );
  }

  openCreateDialog() {
    this.isEditing = false;
    this.managerForm.reset({
      name: '',
      email: '',
      password: '',
      projectId: '',
      locationId: '',
    });
    this.managerForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.managerForm.get('password')?.updateValueAndValidity();

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
    this.managerForm.reset({
      name: manager.name,
      email: manager.email,
      password: '',
      projectId: '',
      locationId: '',
    });
    this.managerForm.get('password')?.clearValidators();
    this.managerForm.get('projectId')?.clearValidators();
    this.managerForm.get('locationId')?.clearValidators();
    this.managerForm.get('password')?.updateValueAndValidity();
    this.managerForm.get('projectId')?.updateValueAndValidity();
    this.managerForm.get('locationId')?.updateValueAndValidity();

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

    const formValue = this.managerForm.getRawValue();
    const selectedProjectId = formValue.projectId ? Number(formValue.projectId) : null;
    const selectedLocationId = formValue.locationId ? Number(formValue.locationId) : null;
    const createPayload: any = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
    };
    if (selectedProjectId) createPayload.projectId = selectedProjectId;
    if (selectedLocationId) createPayload.locationId = selectedLocationId;
    const updatePayload = {
      name: formValue.name,
      email: formValue.email,
      ...(formValue.password ? { password: formValue.password } : {}),
    };
    const shouldAssignInEdit = this.isEditing && !!selectedProjectId && !!selectedLocationId;
    const shouldRejectPartialAssignment = this.isEditing && (!!selectedProjectId !== !!selectedLocationId);
    if (shouldRejectPartialAssignment) {
      toast.error('For edit reassignment, select both project and location');
      return;
    }

    const obs = this.isEditing
      ? this.managersService.update(this.selectedManagerId!, updatePayload).pipe(
        switchMap(() =>
          shouldAssignInEdit
            ? this.managersService.assignProject(this.selectedManagerId!, selectedProjectId!, selectedLocationId!)
            : of(null)
        )
      )
      : this.managersService.create(createPayload);

    obs.subscribe({
      next: () => {
        const successMessage = this.isEditing
          ? (shouldAssignInEdit ? 'Manager updated and reassigned successfully' : 'Manager updated successfully')
          : 'Manager created successfully';
        toast.success(successMessage);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Something went wrong'));
      }
    });
  }

  toggleManagerStatus(manager: User) {
    if (!this.canToggleStatus(manager)) {
      toast.error('You can only activate/deactivate managers created by you');
      return;
    }
    const nextStatus = manager.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.managersService.updateStatus(manager.id, nextStatus).subscribe({
      next: () => {
        toast.success(nextStatus === 'ACTIVE' ? 'Manager activated' : 'Manager deactivated');
        this.refresh$.next();
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Failed to update status'));
      }
    });
  }

  canToggleStatus(manager: User): boolean {
    const creatorId = this.getCreatorId(manager);
    return !!creatorId && !!this.currentUserId && creatorId === this.currentUserId;
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

    const { projectId, locationId } = this.assignForm.value;

    this.managersService.assignProject(this.targetManager!.id, Number(projectId), Number(locationId)).subscribe({
      next: () => {
        toast.success('Project assigned successfully');
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Assignment failed'));
      }
    });
  }

  private getErrorMessage(err: any, fallback: string): string {
    const message = err?.error?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') return JSON.stringify(message);
    return fallback;
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }
}
