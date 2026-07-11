import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, BehaviorSubject, combineLatest, map, shareReplay, startWith, switchMap, take } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../core/services/api';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import {
  ZardFormFieldComponent,
  ZardFormControlComponent,
  ZardFormLabelComponent,
} from '@/shared/components/form';

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
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface AnalystRecord {
  id?: number;
  name?: string;
  email?: string;
  status?: string;
  usercode?: string;
  mobileNumber?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-create-analyst',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardFormLabelComponent,
    ZardButtonComponent,
    ZardInputDirective,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardDialogModule,
    ZardIconComponent,
    ZardSwitchComponent,
    ZardComboboxComponent,
    LottieComponent,
  ],
  templateUrl: './create-analyst.html',
})
export class CreateAnalystComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly createAnalystLoading = signal(false);
  readonly updateAnalystLoading = signal(false);
  readonly analystStatusLoadingIds = signal<Set<number>>(new Set());
  analystSearch = new FormControl('', { nonNullable: true });
  statusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  vm$!: Observable<{
    analysts: AnalystRecord[];
    totalAnalysts: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }>;

  private readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastPageCount = 1;

  @ViewChild('createAnalystDialog')
  createAnalystDialog!: TemplateRef<any>;

  @ViewChild('editAnalystDialog')
  editAnalystDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  form: FormGroup;
  editForm: FormGroup;

  private refresh$ = new Subject<void>();
  options: AnimationOptions = { path: '/loading.json' };

  private readonly rawAnalysts$: Observable<AnalystRecord[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/analysts') as Observable<AnalystRecord[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private analystsSnapshot: AnalystRecord[] = [];

  private readonly filteredAnalysts$: Observable<AnalystRecord[]> = combineLatest([
    this.rawAnalysts$,
    this.analystSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    this.statusFilter.valueChanges.pipe(startWith('ALL' as StatusFilter)),
  ]).pipe(
    map(([analysts, query, status]) => this.filterAnalysts(analysts, query, status)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService,
  ) {
    const namePattern = /^[a-zA-Z\s]*$/;

    this.form = this.fb.group({
      usercode: [{ value: '', disabled: true }],
      name: ['', [Validators.required, Validators.pattern(namePattern), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(namePattern), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
    });

    this.vm$ = combineLatest([
      this.filteredAnalysts$,
      this.page$.asObservable(),
    ]).pipe(
      map(([analysts, page]) => this.buildPageVm(analysts, page)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.rawAnalysts$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((analysts) => {
        this.analystsSnapshot = Array.isArray(analysts) ? analysts : [];
      });
  }

  openCreateDialog() {
    this.createAnalystLoading.set(false);
    this.form.reset({ usercode: { value: '', disabled: true }, name: '', email: '', password: '' });
    this.populateNextAnalystCode();

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Analyst',
      zContent: this.createAnalystDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',
      zOkLoading: this.createAnalystLoading,
      zOnOk: () => {
        this.submit();
        return false;
      },
      zOnCancel: () => {
        this.createAnalystLoading.set(false);
        this.form.reset();
      },
    });
  }

  private populateNextAnalystCode(): void {
    this.api.get('users/next-code?role=ANALYST', undefined, { cache: 'reload' })
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          const raw = res?.code ?? res?.nextCode ?? res?.usercode ?? res?.data?.code;
          const code = raw == null ? '' : String(raw).trim();
          if (code) {
            this.form.get('usercode')?.setValue(code, { emitEvent: false });
          }
        },
        error: () => { /* silently ignore, form shows empty */ },
      });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.createAnalystLoading.set(true);
    this.api.post('users/create-analyst', this.form.value).subscribe({
      next: (res: any) => {
        const code = res?.safeUser?.usercode as string | undefined;
        toast.success(code ? `Analyst created (Code: ${code})` : 'Analyst created successfully');
        this.createAnalystLoading.set(false);
        this.form.reset();
        this.refresh$.next();
        this.dialogRef?.close();
      },
      error: (err) => {
        let msg = 'Something went wrong';
        if (err.status === 400) msg = err.error?.message || 'Bad Request';
        else if (err.status === 409) msg = 'Email already exists';
        else if (err.status === 401) msg = 'Session expired. Login again';
        else if (err.status === 500) msg = 'Server error. Try later';
        this.createAnalystLoading.set(false);
        toast.error(msg);
      },
    });
  }

  openEditDialog(analyst: any) {
    this.editForm.patchValue({ name: analyst.name, email: analyst.email, password: '' });
    this.updateAnalystLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Analyst',
      zContent: this.editAnalystDialog,
      zOkText: 'Update',
      zOkLoading: this.updateAnalystLoading,
      zOnOk: () => {
        this.updateAnalyst(analyst.id);
        return false;
      },
    });
  }

  updateAnalyst(id: number) {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const payload: any = {
      name: this.editForm.value.name,
      email: this.editForm.value.email,
    };
    if (this.editForm.value.password) {
      payload.password = this.editForm.value.password.trim();
    }

    this.updateAnalystLoading.set(true);
    this.api.put(`users/analyst/${id}`, payload).subscribe({
      next: () => {
        toast.success('Analyst updated');
        this.updateAnalystLoading.set(false);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: () => {
        this.updateAnalystLoading.set(false);
        toast.error('Update failed');
      },
    });
  }

  isAnalystStatusLoading(analystId: number | null | undefined): boolean {
    if (!Number.isFinite(analystId)) return false;
    return this.analystStatusLoadingIds().has(Number(analystId));
  }

  private setAnalystStatusLoading(analystId: number | null | undefined, loading: boolean): void {
    if (!Number.isFinite(analystId)) return;
    const next = new Set(this.analystStatusLoadingIds());
    const id = Number(analystId);
    if (loading) next.add(id); else next.delete(id);
    this.analystStatusLoadingIds.set(next);
  }

  toggleAnalystStatus(analyst: any) {
    const analystId = Number(analyst?.id);
    if (!Number.isFinite(analystId) || this.isAnalystStatusLoading(analystId)) return;

    const status = analyst.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.setAnalystStatusLoading(analystId, true);
    this.api.patch(`users/analyst/${analystId}/status`, { status }).subscribe({
      next: () => {
        toast.success(status === 'ACTIVE' ? 'Analyst activated' : 'Analyst deactivated');
        this.refresh$.next();
        this.setAnalystStatusLoading(analystId, false);
      },
      error: () => {
        this.setAnalystStatusLoading(analystId, false);
        toast.error('Failed to update status');
      },
    });
  }

  prevPage() { this.page$.next(Math.max(1, this.lastPage - 1)); }
  nextPage() { this.page$.next(Math.min(this.lastPageCount, this.lastPage + 1)); }

  private filterAnalysts(analysts: AnalystRecord[], query: string, status: StatusFilter): AnalystRecord[] {
    const term = (query ?? '').toLowerCase().trim();
    const statusFilter = (status ?? 'ALL').toUpperCase() as StatusFilter;

    return [...(analysts || [])]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .filter((analyst) => {
        const matchSearch = !term ||
          (analyst.name ?? '').toLowerCase().includes(term) ||
          (analyst.email ?? '').toLowerCase().includes(term);
        const matchStatus = statusFilter === 'ALL' ||
          (analyst.status ?? '').toUpperCase() === statusFilter;
        return matchSearch && matchStatus;
      });
  }

  private buildPageVm(analysts: AnalystRecord[], page: number) {
    const totalAnalysts = analysts.length;
    const pageCount = Math.max(1, Math.ceil(totalAnalysts / this.pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const startIndex = (safePage - 1) * this.pageSize;
    this.lastPage = safePage;
    this.lastPageCount = pageCount;
    return {
      analysts: analysts.slice(startIndex, startIndex + this.pageSize),
      totalAnalysts,
      page: safePage,
      pageSize: this.pageSize,
      pageCount,
    };
  }

  getErrorMessage(f: FormGroup, controlName: string): string {
    const control = f.get(controlName);
    if (!control || !(control.dirty || control.touched) || control.valid) return '';
    if (control.hasError('required')) return `${this.capitalize(controlName)} is required`;
    if (control.hasError('pattern')) return 'Must contain only letters';
    if (control.hasError('maxlength')) return 'Maximum 50 characters allowed';
    if (control.hasError('email')) return 'Invalid email address';
    if (control.hasError('minlength')) return 'Minimum 6 characters required';
    return '';
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
