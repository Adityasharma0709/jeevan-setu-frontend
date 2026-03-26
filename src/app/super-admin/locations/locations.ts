import { Component, DestroyRef, TemplateRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, debounceTime, distinctUntilChanged, shareReplay, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

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
  projectId: number | null;
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
    LottieComponent,
  ],
  templateUrl: './locations.html',
})
export class LocationsComponent {
  private readonly destroyRef = inject(DestroyRef);
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
  options: AnimationOptions = { path: '/loading.json' };

  locations$: Observable<LocationModel[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('locations') as Observable<LocationModel[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private locationsSnapshot: LocationModel[] = [];

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
      projectId: [null],
      // Auto-generated: min total length 4 (2 letters + 2+ digits), e.g., UP01
      locationCode: ['', [Validators.pattern(/^[A-Z]{2}\d{2,}$/)]],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.editForm = this.fb.group({
      projectId: [null],
      locationCode: [''],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.projects$ = (this.api.get('projects') as Observable<ProjectModel[]>).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.locations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((locations) => {
        this.locationsSnapshot = Array.isArray(locations) ? locations : [];
        this.updateAutoLocationCode();
      });

    this.form
      .get('state')
      ?.valueChanges.pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateAutoLocationCode());
    this.form
      .get('district')
      ?.valueChanges.pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateAutoLocationCode());
    this.form
      .get('block')
      ?.valueChanges.pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateAutoLocationCode());
    this.form
      .get('village')
      ?.valueChanges.pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateAutoLocationCode());
  }

  private resetCreateForm(): void {
    this.form.reset({
      projectId: null,
      locationCode: '',
      state: '',
      district: '',
      block: '',
      village: '',
    });

    this.selectedProjectName = '';
    this.updateAutoLocationCode();
  }

  /* =========================
     PROJECT SELECTION
  ========================= */

  selectProject(project: ProjectModel) {
    this.form.patchValue({ projectId: project.id });
    this.selectedProjectName = project.name;
  }

  clearProjectSelection() {
    this.form.patchValue({ projectId: null });
    this.selectedProjectName = '';
  }

  /* =========================
     CREATE LOCATION
  ========================= */

  openCreateDialog() {
    this.resetCreateForm();

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

      zOnCancel: () => this.resetCreateForm(),
    });
  }

  submit() {
    this.updateAutoLocationCode();

    if (this.form.invalid) {
      toast.error('Please fill required fields correctly');
      return;
    }

    this.createLocation(0);
  }

  private createLocation(retryCount: number): void {
    this.api.post('locations', this.form.value).subscribe({
      next: () => {
        toast.success('Location created successfully');
        this.resetCreateForm();
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';

        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) {
          if (retryCount < 2) {
            (this.api.get('locations') as Observable<LocationModel[]>)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (locations) => {
                  this.locationsSnapshot = Array.isArray(locations) ? locations : [];
                  this.updateAutoLocationCode();
                  this.createLocation(retryCount + 1);
                },
                error: () => toast.error('Failed to refresh location codes'),
              });
            return;
          }
          msg = 'Location code already exists';
        }
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';

        toast.error(msg);
      },
    });
  }

  private updateAutoLocationCode(): void {
    const code = this.generateLocationCode();
    this.form.patchValue({ locationCode: code }, { emitEvent: false });
  }

  private generateLocationCode(): string {
    const source = this.getPrefixSource();
    const lettersOnly = source.toUpperCase().replace(/[^A-Z]/g, '');
    const prefix = (lettersOnly + 'LC').slice(0, 2);
    const digits = this.nextSerialDigits(prefix, 2);
    return `${prefix}${digits}`;
  }

  private getPrefixSource(): string {
    const stateValue = (this.form.get('state')?.value ?? '').toString().trim();
    if (stateValue) return stateValue;

    const districtValue = (this.form.get('district')?.value ?? '').toString().trim();
    if (districtValue) return districtValue;

    const blockValue = (this.form.get('block')?.value ?? '').toString().trim();
    if (blockValue) return blockValue;

    return (this.form.get('village')?.value ?? '').toString().trim();
  }

  private nextSerialDigits(prefix: string, minLength: number): string {
    const safePrefix = (prefix ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    const safeLength = Math.max(2, Math.floor(Number(minLength) || 2));

    let maxValue = 0;

    for (const location of this.locationsSnapshot) {
      const code = (location?.locationCode ?? '').toString().trim().toUpperCase();
      const match = code.match(/^([A-Z]{2})(\d+)$/);
      if (!match) continue;
      if (match[1] !== safePrefix) continue;

      const value = Number(match[2]);
      if (!Number.isFinite(value)) continue;
      if (value > maxValue) maxValue = value;
    }

    const nextValue = maxValue + 1;
    const digits = nextValue.toString();
    return digits.length >= safeLength ? digits : digits.padStart(safeLength, '0');
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
