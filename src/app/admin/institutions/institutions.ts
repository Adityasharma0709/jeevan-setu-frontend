import { Component, DestroyRef, OnInit, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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

interface InstitutionModel {
  id: number;
  projectId: number;
  locationCode: string;
  name?: string;       // Dynamic: represents awcName, schoolName or healthCenterName
  awcName?: string;    // Backend returns this for AWCs
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

interface BlockModel {
  id: number;
  name: string;
}

interface VillageModel {
  id: number;
  name: string;
}

@Component({
  selector: 'app-institutions',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardComboboxComponent,
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
  templateUrl: './institutions.html',
})
export class InstitutionsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  public readonly dialogService = inject(ZardDialogService);

  @ViewChild('institutionDialog') institutionDialog!: TemplateRef<any>;
  public dialogRef!: ZardDialogRef<any>;

  readonly isSubmitting = signal(false);
  readonly isLoading = signal(false);
  
  // Navigation & Tabs
  readonly activeTab = signal<'AWC' | 'HEALTH_CENTER' | 'SCHOOL'>('AWC');
  readonly activeTab$ = toObservable(this.activeTab);
  
  form: FormGroup;
  isEditMode = signal(false);
  editingId: number | null = null;
  
  projects$!: Observable<ProjectModel[]>;
  projectOptions$!: Observable<ZardComboboxOption[]>;
  
  allStates: StateModel[] = [];
  stateOptions: ZardComboboxOption[] = [];
  districtOptions$!: Observable<ZardComboboxOption[]>;
  blockOptions$!: Observable<ZardComboboxOption[]>;
  villageOptions$!: Observable<ZardComboboxOption[]>;
  private currentBlocks: BlockModel[] = [];

  private refresh$ = new Subject<void>();
  
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;
  public readonly searchControl = new FormControl('');
  public readonly statusLoadingIds = signal<Set<number>>(new Set());
  
  institutions$!: Observable<InstitutionModel[]>;
  pager$!: Observable<{
    items: InstitutionModel[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  
  allAwcs: InstitutionModel[] = [];
  allHealthCenters: InstitutionModel[] = [];
  allSchools: InstitutionModel[] = [];

  constructor() {
    this.form = this.fb.group({
      projectId: [null, [Validators.required]],
      stateId: [null, [Validators.required]],
      districtId: [null, [Validators.required]],
      block: ['', [Validators.required]],
      village: ['', [Validators.required]],
      type: ['AWC', [Validators.required]],
      name: ['', [Validators.required]],
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

    // 2. Load and Filter Institutions dynamically based on Active Tab
    this.institutions$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.activeTab$,
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      tap(() => this.goToPage(1)),
      switchMap(([_, tab, query]) => {
        this.isLoading.set(true);
        
        let endpoint = 'locations';
        if (tab === 'SCHOOL') endpoint = 'locations/schools';
        else if (tab === 'HEALTH_CENTER') endpoint = 'locations/health-centers';
        
        return (this.api.get(endpoint) as Observable<InstitutionModel[]>).pipe(
          map(items => {
            const list = (items || []).map(item => ({
              ...item,
              name: item.name || item.awcName // Normalize AWC / School / HC name
            }));
            
            // Cache lists to helper arrays for code generation lookup
            if (tab === 'AWC') this.allAwcs = list;
            else if (tab === 'SCHOOL') this.allSchools = list;
            else if (tab === 'HEALTH_CENTER') this.allHealthCenters = list;
            
            const q = (query || '').toLowerCase();
            const filtered = list.filter(loc => {
              return (
                (loc.name?.toLowerCase() || '').includes(q) ||
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
            return of([] as InstitutionModel[]);
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Pagination VM mapping
    this.pager$ = combineLatest([this.institutions$, this.page$]).pipe(
      map(([items, page]) => {
        const total = (items || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const slicedItems = (items || []).slice(startIndex, endIndexExclusive);

        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : endIndexExclusive;

        return {
          items: slicedItems,
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

    // 3. States options dependent on selected Project
    this.form.get('projectId')!.valueChanges.pipe(
      startWith(undefined),
      switchMap(() => {
        const projectId = this.form.get('projectId')?.value;
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

    // 4. District options
    this.districtOptions$ = this.form.get('stateId')!.valueChanges.pipe(
      startWith(undefined),
      switchMap(() => {
        const stateId = this.form.get('stateId')?.value;
        if (!stateId) return of([]);
        return (this.api.get(`locations/districts/${stateId}`) as Observable<DistrictModel[]>).pipe(
          map(districts => (districts || []).map(d => ({ label: d.name, value: String(d.id) })))
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // 5. Block options
    this.blockOptions$ = this.form.get('districtId')!.valueChanges.pipe(
      startWith(undefined),
      switchMap(() => {
        const districtId = this.form.get('districtId')?.value;
        if (!districtId) {
          this.currentBlocks = [];
          return of([]);
        }
        return (this.api.get(`locations/blocks/${districtId}`) as Observable<BlockModel[]>).pipe(
          map(blocks => {
            this.currentBlocks = blocks || [];
            return this.currentBlocks.map(b => ({ label: b.name, value: b.name }));
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // 6. Village options
    this.villageOptions$ = combineLatest([
      this.form.get('districtId')!.valueChanges.pipe(startWith(undefined)),
      this.form.get('block')!.valueChanges.pipe(startWith(undefined))
    ]).pipe(
      switchMap(() => {
        const districtId = this.form.get('districtId')?.value;
        const blockName = this.form.get('block')?.value;
        if (!districtId || !blockName) return of([]);
        return (this.api.get(`locations/villages/by-block-name/${districtId}/${encodeURIComponent(blockName)}`) as Observable<VillageModel[]>).pipe(
          map(villages => (villages || []).map(v => ({ label: v.name, value: v.name })))
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Auto-update code and default name previews
    combineLatest([
      this.form.get('type')!.valueChanges.pipe(startWith('AWC')),
      this.form.get('village')!.valueChanges.pipe(startWith(''))
    ]).pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(([type, village]) => {
      if (!this.isEditMode()) {
        this.updateAutoLocationCode();
      }
      
      const nameCtrl = this.form.get('name');
      const prefixLabel = type === 'AWC' ? 'AWC' : type === 'SCHOOL' ? 'School' : 'Health Center';
      
      if (village && (!nameCtrl?.value || nameCtrl?.value.startsWith('AWC ') || nameCtrl?.value.startsWith('School ') || nameCtrl?.value.startsWith('Health Center '))) {
        nameCtrl?.setValue(`${prefixLabel} ${village}`, { emitEvent: false });
      }
    });
  }

  selectTab(tab: 'AWC' | 'HEALTH_CENTER' | 'SCHOOL') {
    this.activeTab.set(tab);
    this.goToPage(1);
    this.refresh$.next();
  }

  openCreateDialog() {
    this.isEditMode.set(false);
    this.editingId = null;
    this.form.reset({
      type: this.activeTab()
    });
    this.updateAutoLocationCode();
    this.dialogRef = this.dialogService.create({ 
      zTitle: `Create New ${this.getTypeLabel(this.form.value.type)}`,
      zContent: this.institutionDialog,
      zWidth: '500px',
      zOkText: 'Create',
      zOnOk: () => {
        this.submit();
        return false;
      }
    });
  }

  openEditDialog(loc: InstitutionModel) {
    this.isEditMode.set(true);
    this.editingId = loc.id;
    this.form.patchValue({
      projectId: loc.projectId,
      stateId: loc.stateId,
      districtId: loc.districtId,
      block: loc.block,
      village: loc.village,
      type: this.activeTab(),
      name: loc.name,
      locationCode: loc.locationCode
    });
    this.dialogRef = this.dialogService.create({ 
      zTitle: `Edit ${this.getTypeLabel(this.activeTab())}`,
      zContent: this.institutionDialog,
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
    if (!this.isEditMode()) {
      this.form.get('block')?.setValue('');
      this.form.get('village')?.setValue('');
    }
  }

  onBlockSelect(value: string | null) {
    this.form.get('block')?.setValue(value);
    if (!this.isEditMode()) {
      this.form.get('village')?.setValue('');
    }
  }

  onVillageSelect(value: string | null) {
    this.form.get('village')?.setValue(value);
  }

  onFormTypeSelect(type: 'AWC' | 'HEALTH_CENTER' | 'SCHOOL') {
    this.form.get('type')?.setValue(type);
    this.updateAutoLocationCode();
  }

  private updateAutoLocationCode(): void {
    const type = this.form.get('type')?.value || 'AWC';
    let prefix = 'AWC';
    let cacheList: InstitutionModel[] = [];

    if (type === 'SCHOOL') {
      prefix = 'SCH';
      cacheList = this.allSchools;
    } else if (type === 'HEALTH_CENTER') {
      prefix = 'HC';
      cacheList = this.allHealthCenters;
    } else {
      cacheList = this.allAwcs;
    }

    let maxValue = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

    for (const item of cacheList) {
      const code = (item.locationCode || '').toUpperCase();
      const match = code.match(regex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxValue) maxValue = val;
      }
    }

    const nextValue = maxValue + 1;
    const nextCode = `${prefix}${nextValue.toString()}`;
    this.form.get('locationCode')?.setValue(nextCode, { emitEvent: false });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Please fill all required fields');
      return;
    }

    this.isSubmitting.set(true);
    const formVal = this.form.value;
    const tab = formVal.type;

    let payload: any = {
      projectId: formVal.projectId,
      stateId: formVal.stateId,
      districtId: formVal.districtId,
      block: formVal.block,
      village: formVal.village,
      type: formVal.type,
      name: formVal.name,
      locationCode: formVal.locationCode
    };

    let request: Observable<any>;

    if (this.isEditMode()) {
      let endpoint = `locations/${this.editingId}`;
      if (tab === 'SCHOOL') endpoint = `locations/schools/${this.editingId}`;
      else if (tab === 'HEALTH_CENTER') endpoint = `locations/health-centers/${this.editingId}`;
      
      // The update payload on backend maps `awcName` for compatibility
      payload.awcName = formVal.name;
      request = this.api.put(endpoint, payload);
    } else {
      // Unified endpoint handles institution creation
      request = this.api.post('locations/institutions', payload);
    }

    request.subscribe({
      next: () => {
        const label = this.getTypeLabel(tab);
        const msg = this.isEditMode() ? `${label} Updated Successfully` : `${label} Created Successfully`;
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

  toggleStatus(item: InstitutionModel) {
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const tab = this.activeTab();
    
    this.statusLoadingIds.update(set => {
      const next = new Set(set);
      next.add(item.id);
      return next;
    });

    let endpoint = `locations/${item.id}/status`;
    if (tab === 'SCHOOL') endpoint = `locations/schools/${item.id}/status`;
    else if (tab === 'HEALTH_CENTER') endpoint = `locations/health-centers/${item.id}/status`;
    
    this.api.patch(endpoint, { status: newStatus }).subscribe({
      next: () => {
        this.statusLoadingIds.update(set => {
          const next = new Set(set);
          next.delete(item.id);
          return next;
        });
        toast.success(`${this.getTypeLabel(tab)} status updated successfully`);
        this.refresh$.next();
      },
      error: (err) => {
        this.statusLoadingIds.update(set => {
          const next = new Set(set);
          next.delete(item.id);
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

  getTypeLabel(type: string): string {
    if (type === 'SCHOOL') return 'School';
    if (type === 'HEALTH_CENTER') return 'Health Center';
    return 'AWC';
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
