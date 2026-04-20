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

interface AdminRecord {
  id?: number;
  name?: string;
  email?: string;
  status?: string;
  usercode?: string;
  createdAt?: string;
  created_at?: string;
  createdOn?: string;
}

@Component({
  selector: 'app-create-admin',
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
  templateUrl: './create-admin.html',
})
export class CreateAdminComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly createAdminLoading = signal(false);
  readonly updateAdminLoading = signal(false);
  readonly adminStatusLoadingIds = signal<Set<number>>(new Set());
  adminSearch = new FormControl('', { nonNullable: true });
  statusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  vm$!: Observable<{
    admins: AdminRecord[];
    totalAdmins: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }>;

  private readonly pageSize = 10;
  private readonly codePrefix = 'AC';
  private readonly codeMinDigits = 2;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastPageCount = 1;

  /* ======================
     TEMPLATE REFERENCES
  ====================== */

  @ViewChild('createAdminDialog')
  createAdminDialog!: TemplateRef<any>;

  @ViewChild('editAdminDialog')
  editAdminDialog!: TemplateRef<any>;

  @ViewChild('removeAdminDialogTpl')
  removeAdminDialogTpl!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;

  fetchingAdminProjects = false;
  adminProjects: ZardComboboxOption[] = [];
  projectToRemoveCtrl = new FormControl(null, [Validators.required]);
  selectedAdminForRemoval: any = null;
  readonly removingProjectLoading = signal(false);

  /* ======================
     FORMS
  ====================== */

  form: FormGroup;
  editForm: FormGroup;

  /* ======================
     REFRESH STREAM
  ====================== */

  private refresh$ = new Subject<void>();
  options: AnimationOptions = { path: '/loading.json' };

  private readonly rawAdmins$: Observable<AdminRecord[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins') as Observable<AdminRecord[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private adminsSnapshot: AdminRecord[] = [];

  private readonly filteredAdmins$: Observable<AdminRecord[]> = combineLatest([
    this.rawAdmins$,
    this.adminSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    this.statusFilter.valueChanges.pipe(startWith('ALL' as StatusFilter)),
  ]).pipe(
    map(([admins, query, status]) => this.filterAdmins(admins, query, status)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /* ======================
     CONSTRUCTOR
  ====================== */

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialog: ZardDialogService,
  ) {
    const namePattern = /^[a-zA-Z\s]*$/;
    // Create form
    this.form = this.fb.group({
      usercode: [{ value: '', disabled: true }],
      name: ['', [Validators.required, Validators.pattern(namePattern), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    // Edit form
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(namePattern), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
    });

    this.vm$ = combineLatest([
      this.filteredAdmins$,
      this.page$.asObservable(),
    ]).pipe(
      map(([admins, page]) => {
        return this.buildPageVm(admins, page);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.rawAdmins$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((admins) => {
        this.adminsSnapshot = Array.isArray(admins) ? admins : [];
      });
  }

  /* ======================
     CREATE DIALOG
  ====================== */

  openCreateDialog() {
    this.resetCreateForm();
    this.createAdminLoading.set(false);
    this.dialogRef = this.dialog.create({
      zTitle: 'Create Admin',
      zContent: this.createAdminDialog,
      zOkText: 'Create',
      zCancelText: 'Cancel',
      zWidth: '400px',
      zOkLoading: this.createAdminLoading,

      zOnOk: () => {
        this.submit();
        return false;
      },

      zOnCancel: () => {
        this.createAdminLoading.set(false);
        this.resetCreateForm();
      },
    });
  }

  private resetCreateForm(): void {
    this.form.reset({
      usercode: { value: this.getNextAdminCode(), disabled: true },
      name: '',
      email: '',
      password: '',
    });
    this.populateNextAdminCode();
  }

  private populateNextAdminCode(): void {
    this.api.get('users/next-code?role=ADMIN', undefined, { cache: 'reload' })
      .pipe(take(1))
      .subscribe({
        next: (res: any) => {
          const raw = res?.code ?? res?.nextCode ?? res?.usercode ?? res?.data?.code ?? res?.data?.nextCode;
          const code = raw == null ? '' : String(raw).trim();
          if (code) {
            this.form.get('usercode')?.setValue(code, { emitEvent: false });
          }
        },
        error: () => {
          const fallback = this.getNextAdminCode();
          this.form.get('usercode')?.setValue(fallback, { emitEvent: false });
        },
      });
  }

  private getNextAdminCode(): string {
    const codes = this.adminsSnapshot.map((a) => a?.usercode);
    return this.nextSerialCode(this.codePrefix, codes, this.codeMinDigits);
  }

  private nextSerialCode(prefix: string, codes: Array<string | null | undefined>, minDigits: number): string {
    const safePrefix = (prefix ?? '')
      .toString()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .padEnd(2, 'A')
      .slice(0, 2);

    const safeMinDigits = Math.max(2, Math.floor(Number(minDigits) || 2));
    let maxValue = 0;
    let digitsWidth = safeMinDigits;

    for (const raw of codes) {
      const code = (raw ?? '').toString().trim().toUpperCase();
      const match = code.match(/^([A-Z]{2})(\d+)$/);
      if (!match) continue;
      if (match[1] !== safePrefix) continue;

      digitsWidth = Math.max(digitsWidth, match[2].length);

      const value = Number(match[2]);
      if (!Number.isFinite(value)) continue;
      if (value > maxValue) maxValue = value;
    }

    const nextValue = maxValue + 1;
    const digits = nextValue.toString().padStart(digitsWidth, '0');
    return `${safePrefix}${digits}`;
  }

  /* ======================
     CREATE ADMIN
  ====================== */

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.createAdminLoading.set(true);
    this.api.post('users/create-admin', this.form.value).subscribe({
      next: (res: any) => {
        const code = res?.safeUser?.usercode as string | undefined;
        toast.success(code ? `Admin created (Code: ${code})` : 'Admin created successfully');
        this.createAdminLoading.set(false);

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

        this.createAdminLoading.set(false);
        toast.error(msg);
      },
    });
  }

  /* ======================
     EDIT ADMIN
  ====================== */

  openEditDialog(admin: any) {
    this.editForm.patchValue({
      name: admin.name,
      email: admin.email,
      password: '',
    });
    this.updateAdminLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Admin',
      zContent: this.editAdminDialog,
      zOkText: 'Update',
      zOkLoading: this.updateAdminLoading,

      zOnOk: () => {
        this.updateAdmin(admin.id);
        return false;
      },
    });
  }

  updateAdmin(id: number) {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    // Clean payload (prevents 400 error)
    const payload: any = {
      name: this.editForm.value.name,
      email: this.editForm.value.email,
    };

    if (this.editForm.value.password) {
      payload.password = this.editForm.value.password.trim();
    }

    this.updateAdminLoading.set(true);
    this.api.put(`users/admin/${id}`, payload).subscribe({
      next: () => {
        toast.success('Admin updated');
        this.updateAdminLoading.set(false);
        this.refresh$.next();
        this.dialogRef.close();
      },
      error: () => {
        this.updateAdminLoading.set(false);
        toast.error('Update failed');
      },
    });
  }

  /* ======================
     REMOVE FROM PROJECT
  ====================== */

  openRemoveDialog(admin: any) {
    this.selectedAdminForRemoval = admin;
    this.projectToRemoveCtrl.reset();
    this.adminProjects = [];
    this.fetchingAdminProjects = true;
    this.removingProjectLoading.set(false);

    this.api.get(`projects/user/${admin.id}`).subscribe({
      next: (projects: any) => {
        this.fetchingAdminProjects = false;
        this.adminProjects = projects.map((p: any) => ({ label: p.name + (p.projectCode ? ` (${p.projectCode})` : ''), value: p.id }));
      },
      error: () => {
        this.fetchingAdminProjects = false;
        toast.error('Failed to load admin projects');
      }
    });

    this.dialogRef = this.dialog.create({
      zTitle: 'Remove from Project',
      zContent: this.removeAdminDialogTpl,
      zOkText: 'Remove',
      zOkLoading: this.removingProjectLoading,
      zOnOk: () => {
        if (!this.adminProjects.length) {
          this.dialogRef.close();
          return false;
        }
        if (this.projectToRemoveCtrl.invalid) {
          this.projectToRemoveCtrl.markAsTouched();
          toast.error('Please select a project');
          return false;
        }
        
        const projectId = this.projectToRemoveCtrl.value;
        if (projectId !== null) {
          this.removeAssignedProject(admin.id, projectId);
        }
        return false;
      }
    });
  }

  removeAssignedProject(adminId: number, projectId: number) {
    this.removingProjectLoading.set(true);
    this.api.delete(`users/admin/${adminId}/project/${projectId}`).subscribe({
      next: () => {
        toast.success('Admin removed from project');
        this.removingProjectLoading.set(false);
        this.dialogRef.close();
        this.refresh$.next();
      },
      error: () => {
        toast.error('Failed to remove from project');
        this.removingProjectLoading.set(false);
      }
    });
  }

  /* ======================
     TOGGLE STATUS
  ====================== */

  isAdminStatusLoading(adminId: number | null | undefined): boolean {
    if (!Number.isFinite(adminId)) return false;
    return this.adminStatusLoadingIds().has(Number(adminId));
  }

  private setAdminStatusLoading(adminId: number | null | undefined, loading: boolean): void {
    if (!Number.isFinite(adminId)) return;
    const next = new Set(this.adminStatusLoadingIds());
    const id = Number(adminId);
    if (loading) next.add(id);
    else next.delete(id);
    this.adminStatusLoadingIds.set(next);
  }

  toggleAdminStatus(admin: any) {
    const adminId = Number(admin?.id);
    if (!Number.isFinite(adminId)) return;
    if (this.isAdminStatusLoading(adminId)) return;

    const status = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.setAdminStatusLoading(adminId, true);
    this.api.patch(`users/admin/${adminId}/status`, { status }).subscribe({
      next: () => {
        toast.success(
          status === 'ACTIVE'
            ? 'Admin activated'
            : 'Admin deactivated',
        );

        this.refresh$.next();
        this.setAdminStatusLoading(adminId, false);
      },
      error: () => {
        this.setAdminStatusLoading(adminId, false);
        toast.error('Failed to update status');
      },
    });
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastPageCount, this.lastPage + 1));
  }

  private filterAdmins(admins: AdminRecord[], query: string, status: StatusFilter): AdminRecord[] {
    const term = this.normalizeText(query);
    const statusFilter = this.normalizeStatus(status);

    const sorted = [...(admins || [])].sort(
      (a, b) => this.getAdminSortTime(b) - this.getAdminSortTime(a)
    );

    return sorted.filter((admin) =>
      this.matchesSearch(admin, term) && this.matchesStatus(admin, statusFilter)
    );
  }

  private buildPageVm(admins: AdminRecord[], page: number) {
    const totalAdmins = admins.length;
    const pageCount = Math.max(1, Math.ceil(totalAdmins / this.pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const startIndex = (safePage - 1) * this.pageSize;

    this.lastPage = safePage;
    this.lastPageCount = pageCount;

    return {
      admins: admins.slice(startIndex, startIndex + this.pageSize),
      totalAdmins,
      page: safePage,
      pageSize: this.pageSize,
      pageCount,
    };
  }

  private matchesSearch(admin: AdminRecord, term: string): boolean {
    if (!term) return true;
    const name = this.normalizeText(admin?.name);
    const email = this.normalizeText(admin?.email);
    return name.includes(term) || email.includes(term);
  }

  private matchesStatus(admin: AdminRecord, status: StatusFilter): boolean {
    if (status === 'ALL') return true;
    return this.normalizeStatus(admin?.status) === status;
  }

  private normalizeText(value: unknown): string {
    return (value ?? '').toString().toLowerCase().trim();
  }

  private normalizeStatus(value: unknown): StatusFilter {
    const normalized = (value ?? 'ALL').toString().toUpperCase();
    if (normalized === 'ACTIVE' || normalized === 'INACTIVE' || normalized === 'ALL') {
      return normalized;
    }
    return 'ALL';
  }

  private getAdminSortTime(admin: AdminRecord): number {
    const createdAt = admin?.createdAt ?? admin?.created_at ?? admin?.createdOn;
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }

    const id = admin?.id;
    return typeof id === 'number' ? id : 0;
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
