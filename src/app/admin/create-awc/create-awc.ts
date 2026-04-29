import { Component, DestroyRef, OnInit, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, of, startWith, switchMap, map, combineLatest, Subject, catchError, BehaviorSubject, debounceTime, distinctUntilChanged, tap, shareReplay } from 'rxjs';
import { toast } from 'ngx-sonner';

import { ApiService } from '../../core/services/api';

/* =========================
   ZARD UI IMPORTS
========================= */
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardFormFieldComponent, ZardFormControlComponent } from '@/shared/components/form';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';
import { 
  ZardTableComponent, 
  ZardTableHeaderComponent, 
  ZardTableBodyComponent, 
  ZardTableRowComponent, 
  ZardTableHeadComponent, 
  ZardTableCellComponent 
} from '@/shared/components/table';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardSwitchComponent } from '@/shared/components/switch';

/* =========================
   INTERFACES
========================= */
interface ProjectModel {
  id: number;
  name: string;
  status?: string;
}

interface AwcModel {
  id: number;
  projectId: number;
  locationCode: string;
  awcName?: string;
  stateId: number;
  districtId?: number;
  stateName?: string;
  districtName?: string;
  block?: string;
  village?: string;
  status: string;
  project?: {
    id: number;
    name: string;
  };
}

interface StateModel {
  id: number;
  name: string;
}

interface DistrictModel {
  id: number;
  name: string;
}

@Component({
  selector: 'app-create-awc',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardComboboxComponent,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardDialogModule,
    ZardIconComponent,
    ZardSwitchComponent
  ],
  templateUrl: './create-awc.html',
})
export class CreateAwcComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  public readonly dialogService = inject(ZardDialogService);

  @ViewChild('awcDialog') awcDialog!: TemplateRef<any>;
  public dialogRef!: ZardDialogRef<any>;

  readonly isSubmitting = signal(false);
  readonly isLoading = signal(false);
  readonly isAllIndia = signal(false);
  
  form: FormGroup;
  isEditMode = signal(false);
  editingId: number | null = null;
  
  projects$!: Observable<ProjectModel[]>;
  projectOptions$!: Observable<ZardComboboxOption[]>;
  
  allStates: StateModel[] = [];
  stateOptions: ZardComboboxOption[] = [];
  districtOptions$!: Observable<ZardComboboxOption[]>;

  private refresh$ = new Subject<void>();
  
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;
  public readonly searchControl = new FormControl('');
  public readonly statusLoadingIds = signal<Set<number>>(new Set());
  
  locations$!: Observable<AwcModel[]>;
  pager$!: Observable<{
    items: AwcModel[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  allLocations: AwcModel[] = [];

  constructor() {
    this.form = this.fb.group({
      projectId: [null, [Validators.required]],
      stateId: [null, [Validators.required]],
      districtId: [null, [Validators.required]],
      block: ['', [Validators.required]],
      village: ['', [Validators.required]],
      awcName: ['', [Validators.required]],
      locationCode: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // 1. Load Projects
    this.projects$ = (this.api.get('projects') as Observable<ProjectModel[]>).pipe(
      map(projects => (projects || []).filter(p => p.status === 'ACTIVE')),
      takeUntilDestroyed(this.destroyRef)
    );

    this.projectOptions$ = this.projects$.pipe(
      map(projects => projects.map(p => ({ label: p.name, value: String(p.id) })))
    );

    // 2. Load and Filter AWCs
    this.locations$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      tap(() => this.goToPage(1)),
      switchMap(([_, query]) => {
        this.isLoading.set(true);
        return (this.api.get('locations') as Observable<AwcModel[]>).pipe(
          map(locs => {
            this.allLocations = locs || [];
            const filtered = this.allLocations.filter(loc => {
              const q = (query || '').toLowerCase();
              return (
                (loc.awcName?.toLowerCase() || '').includes(q) ||
                (loc.locationCode?.toLowerCase() || '').includes(q) ||
                (loc.village?.toLowerCase() || '').includes(q) ||
                (loc.block?.toLowerCase() || '').includes(q) ||
                (loc.districtName?.toLowerCase() || '').includes(q) ||
                (loc.stateName?.toLowerCase() || '').includes(q) ||
                (loc.project?.name?.toLowerCase() || '').includes(q)
              );
            });
            this.isLoading.set(false);
            return filtered;
          }),
          catchError(() => {
            this.isLoading.set(false);
            return of([] as AwcModel[]);
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // 2.1 Pagination logic
    this.pager$ = combineLatest([this.locations$, this.page$]).pipe(
      map(([locations, page]) => {
        const total = (locations || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (locations || []).slice(startIndex, endIndexExclusive);

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
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // 3. Dynamic State Options based on Selected Project
    this.form.get('projectId')!.valueChanges.pipe(
      startWith(this.form.get('projectId')?.value),
      switchMap(projectId => {
        if (!projectId) return of([]);
        return (this.api.get(`locations/project/${projectId}/states`) as Observable<StateModel[]>).pipe(
          map(states => {
            this.allStates = states || [];
            this.stateOptions = this.allStates.map(s => ({ label: s.name, value: String(s.id) }));
            return this.stateOptions;
          }),
          catchError(() => {
            this.stateOptions = [];
            return of([]);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    // 4. Dynamic District Options based on Selected State
    this.districtOptions$ = this.form.get('stateId')!.valueChanges.pipe(
      startWith(this.form.get('stateId')?.value),
      switchMap(stateId => {
        if (!stateId) return of([]);
        return (this.api.get(`locations/districts/${stateId}`) as Observable<DistrictModel[]>).pipe(
          map(districts => (districts || []).map(d => ({ label: d.name, value: String(d.id) })))
        );
      })
    );

    // Auto-update code and AWC Name
    combineLatest([
        this.form.get('stateId')!.valueChanges.pipe(startWith(null)),
        this.form.get('districtId')!.valueChanges.pipe(startWith(null)),
        this.form.get('village')!.valueChanges.pipe(startWith(''))
    ]).pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(([stateId, districtId, village]) => {
        if (!this.isEditMode()) {
            this.updateAutoLocationCode();
        }
        
        const awcCtrl = this.form.get('awcName');
        if (village && (!awcCtrl?.value || awcCtrl?.value === `AWC ${village}`)) {
            awcCtrl?.setValue(`AWC ${village}`, { emitEvent: false });
        }
    });
  }

  openCreateDialog() {
    this.isEditMode.set(false);
    this.editingId = null;
    this.form.reset();
    this.updateAutoLocationCode();
    this.dialogRef = this.dialogService.create({ 
      zTitle: 'Create New AWC',
      zContent: this.awcDialog,
      zWidth: '500px',
      zOkText: 'Create',
      zOnOk: () => {
        this.submit();
        return false;
      }
    });
  }

  openEditDialog(loc: AwcModel) {
    this.isEditMode.set(true);
    this.editingId = loc.id;
    this.form.patchValue({
      projectId: loc.projectId,
      stateId: loc.stateId,
      districtId: loc.districtId,
      block: loc.block,
      village: loc.village,
      awcName: loc.awcName,
      locationCode: loc.locationCode
    });
    this.dialogRef = this.dialogService.create({ 
      zTitle: 'Edit AWC',
      zContent: this.awcDialog,
      zWidth: '500px',
      zOkText: 'Update',
      zOnOk: () => {
        this.submit();
        return false;
      }
    });
  }

  onProjectSelect(value: string | null) {
    this.form.get('projectId')?.setValue(value ? Number(value) : null);
  }

  onStateSelect(value: string | null) {
    const id = value ? Number(value) : null;
    this.form.get('stateId')?.setValue(id);
    if (!this.isEditMode()) {
        this.form.get('districtId')?.setValue(null);
    }
  }

  onDistrictSelect(value: string | null) {
    this.form.get('districtId')?.setValue(value ? Number(value) : null);
  }

  private updateAutoLocationCode(): void {
    const prefix = 'AWC';
    let maxValue = 0;

    for (const loc of this.allLocations) {
      const code = (loc.locationCode || '').toUpperCase();
      const match = code.match(/^AWC(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxValue) maxValue = val;
      }
    }

    const nextValue = maxValue + 1;
    const nextCode = `${prefix}${nextValue.toString().padStart(2, '0')}`;
    this.form.get('locationCode')?.setValue(nextCode, { emitEvent: false });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Please fill all required fields');
      return;
    }

    this.isSubmitting.set(true);
    const payload = this.form.value;

    let request: Observable<any>;

    if (this.isEditMode()) {
      request = this.api.put(`locations/${this.editingId}`, payload);
    } else {
      request = this.api.post('locations', payload);
    }

    request.subscribe({
      next: (res) => {
        const msg = this.isAllIndia() ? res.message : (this.isEditMode() ? 'AWC Updated Successfully' : 'AWC Created Successfully');
        toast.success(msg);
        this.isSubmitting.set(false);
        this.dialogRef.close();
        this.refresh$.next();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        toast.error(err?.error?.message || 'Failed to process request');
      }
    });
  }

  toggleAwcStatus(loc: AwcModel) {
    const newStatus = loc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    this.statusLoadingIds.update(set => {
      const next = new Set(set);
      next.add(loc.id);
      return next;
    });
    
    // Use the correct location update endpoint: locations/:id
    this.api.put(`locations/${loc.id}`, { status: newStatus }).subscribe({
      next: () => {
        this.statusLoadingIds.update(set => {
          const next = new Set(set);
          next.delete(loc.id);
          return next;
        });
        toast.success(`AWC ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
        this.refresh$.next();
      },
      error: (err) => {
        this.statusLoadingIds.update(set => {
          const next = new Set(set);
          next.delete(loc.id);
          return next;
        });
        toast.error(err?.error?.message || 'Failed to update status');
      }
    });
  }

  isStatusLoading(id: number): boolean {
    return this.statusLoadingIds().has(id);
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (control?.touched && control?.invalid) {
      if (control.errors?.['required']) return 'This field is required';
    }
    return '';
  }

  toString(val: any): string | null {
    return val !== null && val !== undefined ? String(val) : null;
  }

  cancel() {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
  }
}
