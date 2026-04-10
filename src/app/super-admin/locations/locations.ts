import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable, Subject, combineLatest, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '../../core/services/api';

/* =========================
   ZARD UI IMPORTS
========================= */


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

import { ZardDropdownDirective } from '@/shared/components/dropdown';

import { ZardFormFieldComponent, ZardFormControlComponent } from '@/shared/components/form';
import { ZardSwitchComponent } from '@/shared/components/switch';

/* =========================
   INTERFACES
========================= */

interface ProjectModel {
  id: number;
  name: string;
  status?: string;
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
  createdAt?: string;
}

type LocationStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface LocationPagerVm {
  locations: LocationModel[];
  totalLocations: number;
  page: number;
  pageSize: number;
  pageCount: number;
  from: number;
  to: number;
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

    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardSwitchComponent,

    LottieComponent,
  ],
  templateUrl: './locations.html',
})
export class LocationsComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly createLocationLoading = signal(false);
  readonly assignProjectLoading = signal(false);
  readonly updateLocationLoading = signal(false);
  readonly locationStatusLoadingIds = signal<Set<number>>(new Set());
  /* =========================
     TEMPLATE REFERENCES
  ========================= */

  @ViewChild('createLocationDialog') createLocationDialog!: TemplateRef<any>;
  @ViewChild('editLocationDialog') editLocationDialog!: TemplateRef<any>;
  @ViewChild('locationDetailsDialog') locationDetailsDialog!: TemplateRef<any>;
  @ViewChild('assignProjectDialog') assignProjectDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  /* =========================
     FORMS
  ========================= */

  form: FormGroup;
  editForm: FormGroup;
  assignProjectForm: FormGroup;

  /* =========================
     DATA STREAMS
  ========================= */

  private refresh$ = new Subject<void>();
  options: AnimationOptions = { path: '/loading.json' };

  locationSearch = new FormControl('');
  statusFilter = new FormControl<LocationStatusFilter>('ALL');

  private readonly rawLocations$: Observable<LocationModel[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('locations') as Observable<LocationModel[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private locationsSnapshot: LocationModel[] = [];
  private projectsSnapshot: ProjectModel[] = [];

  vm$!: Observable<LocationPagerVm>;
  private readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastPageCount = 1;

  projects$: Observable<ProjectModel[]>;

  selectedProjectName = '';
  selectedLocationDetails: LocationModel | null = null;
  targetLocation: LocationModel | null = null;

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
      // Auto-generated: must be like LC01 (min length 4)
      locationCode: ['', [Validators.required, Validators.pattern(/^LC\d{2,}$/i)]],
      state: ['', [Validators.required]],
      district: ['', [Validators.required]],
      block: ['', [Validators.required]],
      village: ['', [Validators.required]],
    });

    this.editForm = this.fb.group({
      projectId: [null],
      locationCode: [''],
      state: [''],
      district: [''],
      block: [''],
      village: [''],
    });

    this.assignProjectForm = this.fb.group({
      projectId: [null],
    });

    this.projects$ = (this.api.get('projects') as Observable<ProjectModel[]>).pipe(
      map((projects) =>
        (projects || []).filter(
          (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.projects$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((projects) => {
        this.projectsSnapshot = Array.isArray(projects) ? projects : [];
      });

    this.rawLocations$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((locations) => {
        this.locationsSnapshot = Array.isArray(locations) ? locations : [];
        this.updateAutoLocationCode();
      });

    const filteredLocations$ = combineLatest([
      this.rawLocations$,
      this.locationSearch.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()),
      this.statusFilter.valueChanges.pipe(startWith('ALL' as LocationStatusFilter), distinctUntilChanged()),
    ]).pipe(
      map(([locations, query, status]) => {
        const q = (query ?? '').toString().toLowerCase().trim();
        const s = (status ?? 'ALL').toString().toUpperCase();

        return (locations ?? []).filter((l) => {
          const code = (l?.locationCode ?? '').toString().toLowerCase();
          const project = (l?.project?.name ?? '').toString().toLowerCase();
          const state = (l?.state ?? '').toString().toLowerCase();
          const district = (l?.district ?? '').toString().toLowerCase();
          const block = (l?.block ?? '').toString().toLowerCase();
          const village = (l?.village ?? '').toString().toLowerCase();
          const statusText = (l?.status ?? '').toString().toUpperCase();

          const matchesSearch =
            !q ||
            code.includes(q) ||
            project.includes(q) ||
            state.includes(q) ||
            district.includes(q) ||
            block.includes(q) ||
            village.includes(q) ||
            statusText.toLowerCase().includes(q);

          const matchesStatus = s === 'ALL' || statusText === s;

          return matchesSearch && matchesStatus;
        });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    // reset paging on search
    this.locationSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));

    // reset paging on status filter
    this.statusFilter.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.page$.next(1));

    this.vm$ = combineLatest([filteredLocations$, this.page$.asObservable()]).pipe(
      map(([locations, page]) => {
        const sorted = [...(locations ?? [])].sort(
          (a, b) => this.getLocationSortTime(b) - this.getLocationSortTime(a),
        );

        const totalLocations = sorted.length;
        const pageCount = Math.max(1, Math.ceil(totalLocations / this.pageSize));
        const safePage = Math.min(Math.max(1, page), pageCount);
        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, totalLocations);

        this.lastPage = safePage;
        this.lastPageCount = pageCount;

        const from = totalLocations === 0 ? 0 : startIndex + 1;
        const to = totalLocations === 0 ? 0 : endIndexExclusive;

        return {
          locations: sorted.slice(startIndex, endIndexExclusive),
          totalLocations,
          page: safePage,
          pageSize: this.pageSize,
          pageCount,
          from,
          to,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

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
    this.createLocationLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Location',
      zContent: this.createLocationDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.createLocationLoading,

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => {
        this.createLocationLoading.set(false);
        this.resetCreateForm();
      },
    });
  }

  submit() {
    this.updateAutoLocationCode();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Please fill required fields correctly');
      return;
    }

    this.createLocationLoading.set(true);
    this.createLocation(0);
  }

  private createLocation(retryCount: number): void {
    const raw = this.form.getRawValue() as {
      projectId: number | null;
      locationCode: string;
      state: string;
      district: string;
      block: string;
      village: string;
    };

    const payload: any = {
      locationCode: (raw.locationCode ?? '').toString().trim().toUpperCase(),
      state: (raw.state ?? '').toString().trim(),
      district: (raw.district ?? '').toString().trim(),
      block: (raw.block ?? '').toString().trim(),
      village: (raw.village ?? '').toString().trim(),
    };

    if (typeof raw.projectId === 'number' && Number.isFinite(raw.projectId)) {
      const exists = this.projectsSnapshot.some((p) => Number(p?.id) === Number(raw.projectId));
      if (!exists) {
        toast.error('Selected project is inactive or unavailable');
        this.createLocationLoading.set(false);
        return;
      }
      payload.projectId = raw.projectId;
    }

    this.api.post('locations', payload).subscribe({
      next: () => {
        toast.success('Location created successfully');
        this.createLocationLoading.set(false);
        this.resetCreateForm();
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';

        if (err.status === 400) msg = this.getHttpErrorMessage(err, 'Bad Request');
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
                error: () => {
                  this.createLocationLoading.set(false);
                  toast.error('Failed to refresh location codes');
                },
              });
            return;
          }
          msg = 'Location code already exists';
        }
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';

        this.createLocationLoading.set(false);
        toast.error(msg);
      },
    });
  }

  private getHttpErrorMessage(err: any, fallback: string): string {
    const errorBody = err?.error;
    const message = errorBody?.message ?? errorBody ?? err?.message;

    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.map((m) => (m ?? '').toString()).filter(Boolean).join(', ') || fallback;
    if (message && typeof message === 'object') {
      if (typeof (message as any).message === 'string') return (message as any).message;
      try {
        return JSON.stringify(message);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  private updateAutoLocationCode(): void {
    const code = this.generateLocationCode();
    this.form.patchValue({ locationCode: code }, { emitEvent: false });
  }

  private generateLocationCode(): string {
    const prefix = 'LC';
    const digits = this.nextSerialDigits(prefix, 2);
    return `${prefix}${digits}`;
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
     VIEW DETAILS
  ========================= */

  openLocationDetails(location: LocationModel) {
    this.selectedLocationDetails = location;

    this.dialogRef = this.dialog.create({
      zTitle: `Location Details: ${location.locationCode}`,
      zContent: this.locationDetailsDialog,
      zOkText: 'Close',
      zWidth: '500px',
      zOnOk: () => {
        this.selectedLocationDetails = null;
      },
      zOnCancel: () => {
        this.selectedLocationDetails = null;
      },
    });
  }

  /* =========================
     ASSIGN PROJECT
  ========================= */

  openAssignProjectDialog(location: LocationModel) {
    if ((location?.status ?? '').toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Only active locations can be assigned');
      return;
    }
    this.targetLocation = location;
    this.assignProjectLoading.set(false);
    this.assignProjectForm.reset({
      projectId: location.projectId ?? null,
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Project: ${location.locationCode}`,
      zContent: this.assignProjectDialog,
      zOkText: 'Assign',
      zCancelText: 'Cancel',
      zWidth: '450px',
      zOkLoading: this.assignProjectLoading,
      zOnOk: () => {
        this.assignProjectToLocation();
        return false;
      },
      zOnCancel: () => {
        this.targetLocation = null;
        this.assignProjectLoading.set(false);
        this.assignProjectForm.reset();
      },
    });
  }

  private assignProjectToLocation(): void {
    if (!this.targetLocation) {
      toast.error('No location selected');
      return;
    }

    if ((this.targetLocation?.status ?? '').toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Only active locations can be assigned');
      return;
    }

    this.assignProjectLoading.set(true);
    const projectId = this.assignProjectForm.value.projectId;
    if (typeof projectId === 'number' && Number.isFinite(projectId)) {
      const exists = this.projectsSnapshot.some((p) => Number(p?.id) === Number(projectId));
      if (!exists) {
        toast.error('Selected project is inactive or unavailable');
        this.assignProjectLoading.set(false);
        return;
      }
    }

    const payload: any = {
      projectId: typeof projectId === 'number' && Number.isFinite(projectId) ? projectId : null,
      locationCode: this.targetLocation.locationCode,
      state: this.targetLocation.state,
      district: this.targetLocation.district,
      block: this.targetLocation.block,
      village: this.targetLocation.village,
    };

    this.api.put(`locations/${this.targetLocation.id}`, payload).subscribe({
      next: () => {
        toast.success('Project assigned successfully');
        this.assignProjectLoading.set(false);
        this.targetLocation = null;
        this.assignProjectForm.reset();
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        this.assignProjectLoading.set(false);
        if (err?.status === 409) {
          toast.info('Already assigned');
          return;
        }
        const msg = err?.status === 400 ? this.getHttpErrorMessage(err, 'Bad Request') : 'Failed to assign project';
        toast.error(msg);
      },
    });
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastPageCount, this.lastPage + 1));
  }

  private getLocationSortTime(location: LocationModel): number {
    const anyLocation = location as any;
    const createdAt = anyLocation?.createdAt ?? anyLocation?.created_at ?? anyLocation?.createdOn;
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }

    const id = anyLocation?.id;
    return typeof id === 'number' ? id : 0;
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
    this.updateLocationLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Location',
      zContent: this.editLocationDialog,
      zOkText: 'Update',
      zOkLoading: this.updateLocationLoading,

      zOnOk: () => {
        this.updateLocation(location.id);
        return false;
      },
    });
  }

  updateLocation(id: number) {
    const raw = this.editForm.getRawValue() as any;
    const projectId = raw?.projectId;
    if (typeof projectId === 'number' && Number.isFinite(projectId)) {
      const exists = this.projectsSnapshot.some((p) => Number(p?.id) === Number(projectId));
      if (!exists) {
        toast.error('Selected project is inactive or unavailable');
        return;
      }
    }

    this.updateLocationLoading.set(true);
    this.api.put(`locations/${id}`, raw).subscribe({
      next: () => {
        toast.success('Location updated');
        this.updateLocationLoading.set(false);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: () => {
        this.updateLocationLoading.set(false);
        toast.error('Failed to update location');
      },
    });
  }

  /* =========================
     STATUS TOGGLE
  ========================= */

  isLocationStatusLoading(locationId: number): boolean {
    return this.locationStatusLoadingIds().has(locationId);
  }

  private setLocationStatusLoading(locationId: number, loading: boolean): void {
    const next = new Set(this.locationStatusLoadingIds());
    if (loading) next.add(locationId);
    else next.delete(locationId);
    this.locationStatusLoadingIds.set(next);
  }

  toggleLocationStatus(location: LocationModel) {
    if (this.isLocationStatusLoading(location.id)) return;
    const status = location.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.setLocationStatusLoading(location.id, true);
    this.api.patch(`locations/${location.id}/status`, { status }).subscribe({
      next: () => {
        toast.success(
          status === 'ACTIVE'
            ? 'Location activated'
            : 'Location deactivated'
        );
        this.refresh$.next();
        this.setLocationStatusLoading(location.id, false);
      },
      error: () => {
        this.setLocationStatusLoading(location.id, false);
        toast.error('Failed to update status');
      },
    });
  }
}
