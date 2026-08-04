import { Component, DestroyRef, OnInit, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, of, startWith, switchMap, map, combineLatest, Subject, catchError, BehaviorSubject, tap, shareReplay } from 'rxjs';
import { toast } from 'ngx-sonner';

import { ApiService } from '../../core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardFormFieldComponent, ZardFormControlComponent } from '@/shared/components/form';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardIconComponent } from '@/shared/components/icon';

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
  selector: 'app-cluster',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardComboboxComponent,
    ZardDialogModule,
    ZardIconComponent
  ],
  templateUrl: './cluster.html',
})
export class ClusterComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  public readonly dialogService = inject(ZardDialogService);

  @ViewChild('blockDialog') blockDialog!: TemplateRef<any>;
  @ViewChild('villageDialog') villageDialog!: TemplateRef<any>;
  public dialogRef!: ZardDialogRef<any>;

  readonly isSubmitting = signal(false);
  readonly isLoadingBlocks = signal(false);
  readonly isLoadingVillages = signal(false);

  // Form controls
  readonly selectedStateId = new FormControl<number | null>(null);
  readonly selectedDistrictId = new FormControl<number | null>(null);
  
  // Selected geo entities
  readonly selectedBlock = signal<BlockModel | null>(null);

  // Lists
  allStates: StateModel[] = [];
  stateOptions: ZardComboboxOption[] = [];
  districtOptions$!: Observable<ZardComboboxOption[]>;

  blocks: BlockModel[] = [];
  villages: VillageModel[] = [];

  // Creation forms
  blockForm: FormGroup;
  villageForm: FormGroup;

  private refreshBlocks$ = new Subject<void>();
  private refreshVillages$ = new Subject<void>();

  constructor() {
    this.blockForm = this.fb.group({
      name: ['', [Validators.required]]
    });
    this.villageForm = this.fb.group({
      name: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // 1. Fetch all states
    (this.api.get('locations/states') as Observable<StateModel[]>).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (states) => {
        this.allStates = states || [];
        this.stateOptions = this.allStates.map(s => ({ label: s.name, value: String(s.id) }));
      },
      error: () => toast.error('Failed to load states')
    });

    // 2. Load Districts based on selected State
    this.districtOptions$ = this.selectedStateId.valueChanges.pipe(
      startWith(null),
      switchMap(stateId => {
        if (!stateId) return of([]);
        return (this.api.get(`locations/districts/${stateId}`) as Observable<DistrictModel[]>).pipe(
          map(districts => (districts || []).map(d => ({ label: d.name, value: String(d.id) }))),
          catchError(() => {
            toast.error('Failed to load districts');
            return of([]);
          })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // Reset district and tables when state changes
    this.selectedStateId.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.selectedDistrictId.setValue(null);
      this.blocks = [];
      this.selectedBlock.set(null);
      this.villages = [];
    });

    // 3. Load Blocks based on District change or block refresh
    combineLatest([
      this.selectedDistrictId.valueChanges.pipe(startWith(null)),
      this.refreshBlocks$.pipe(startWith(undefined))
    ]).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(([districtId]) => {
      this.selectedBlock.set(null);
      this.villages = [];
      if (!districtId) {
        this.blocks = [];
        return;
      }
      this.isLoadingBlocks.set(true);
      (this.api.get(`locations/blocks/${districtId}`) as Observable<BlockModel[]>).subscribe({
        next: (blocks) => {
          this.blocks = blocks || [];
          this.isLoadingBlocks.set(false);
        },
        error: () => {
          this.isLoadingBlocks.set(false);
          toast.error('Failed to load blocks');
        }
      });
    });

    // 4. Load Villages when Block changes or village refresh
    combineLatest([
      this.refreshVillages$.pipe(startWith(undefined))
    ]).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const block = this.selectedBlock();
      if (!block) {
        this.villages = [];
        return;
      }
      this.isLoadingVillages.set(true);
      (this.api.get(`locations/villages/${block.id}`) as Observable<VillageModel[]>).subscribe({
        next: (villages) => {
          this.villages = villages || [];
          this.isLoadingVillages.set(false);
        },
        error: () => {
          this.isLoadingVillages.set(false);
          toast.error('Failed to load villages');
        }
      });
    });
  }

  onStateSelect(value: string | null) {
    this.selectedStateId.setValue(value ? Number(value) : null);
  }

  onDistrictSelect(value: string | null) {
    this.selectedDistrictId.setValue(value ? Number(value) : null);
  }

  selectBlock(block: BlockModel) {
    this.selectedBlock.set(block);
    this.refreshVillages$.next();
  }

  openCreateBlockDialog() {
    this.blockForm.reset();
    this.dialogRef = this.dialogService.create({
      zTitle: 'Create New Block',
      zContent: this.blockDialog,
      zWidth: '400px',
      zOkText: 'Create',
      zOnOk: () => {
        this.submitBlock();
        return false;
      }
    });
  }

  submitBlock() {
    if (this.blockForm.invalid) {
      this.blockForm.markAllAsTouched();
      return;
    }
    const districtId = this.selectedDistrictId.value;
    if (!districtId) return;

    this.isSubmitting.set(true);
    const payload = {
      districtId,
      name: this.blockForm.value.name
    };

    this.api.post('locations/blocks', payload).subscribe({
      next: () => {
        toast.success('Block created successfully');
        this.isSubmitting.set(false);
        this.dialogRef.close();
        this.refreshBlocks$.next();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        toast.error(err?.error?.message || 'Failed to create block');
      }
    });
  }

  openCreateVillageDialog() {
    this.villageForm.reset();
    this.dialogRef = this.dialogService.create({
      zTitle: 'Create New Village',
      zContent: this.villageDialog,
      zWidth: '400px',
      zOkText: 'Create',
      zOnOk: () => {
        this.submitVillage();
        return false;
      }
    });
  }

  submitVillage() {
    if (this.villageForm.invalid) {
      this.villageForm.markAllAsTouched();
      return;
    }
    const block = this.selectedBlock();
    if (!block) return;

    this.isSubmitting.set(true);
    const payload = {
      blockId: block.id,
      name: this.villageForm.value.name
    };

    this.api.post('locations/villages', payload).subscribe({
      next: () => {
        toast.success('Village created successfully');
        this.isSubmitting.set(false);
        this.dialogRef.close();
        this.refreshVillages$.next();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        toast.error(err?.error?.message || 'Failed to create village');
      }
    });
  }

  getErrorMessage(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (control?.touched && control?.invalid) {
      if (control.errors?.['required']) return 'This field is required';
    }
    return '';
  }

  toString(val: any): string | null {
    return val !== null && val !== undefined ? String(val) : null;
  }
}
