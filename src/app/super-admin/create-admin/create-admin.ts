import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, BehaviorSubject, combineLatest, map, shareReplay, startWith, switchMap } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../core/services/api';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import {
  ZardFormFieldComponent,
  ZardFormControlComponent,
  ZardFormLabelComponent,
  ZardFormMessageComponent,
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
  ZardTableCaptionComponent,
} from '@/shared/components/table';

import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-create-admin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardFormLabelComponent,
    ZardFormMessageComponent,
    ZardButtonComponent,
    ZardInputDirective,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardTableCaptionComponent,
    ZardDialogModule,
    LottieComponent,
  ],
  templateUrl: './create-admin.html',
})
export class CreateAdminComponent {
  private readonly destroyRef = inject(DestroyRef);
  readonly createAdminLoading = signal(false);
  readonly updateAdminLoading = signal(false);
  readonly adminStatusLoadingIds = signal<Set<number>>(new Set());
  adminSearch = new FormControl('');
  statusFilter = new FormControl<StatusFilter>('ALL');

  vm$!: Observable<{
    admins: any[];
    totalAdmins: number;
    page: number;
    pageSize: number;
    pageCount: number;
  }>;

  private readonly pageSize = 10;
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

  dialogRef!: ZardDialogRef<any>;

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

  private readonly rawAdmins$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.api.get('users/admins') as Observable<any[]>),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private adminsSnapshot: any[] = [];

  private readonly filteredAdmins$: Observable<any[]> = combineLatest([
    this.rawAdmins$,
    this.adminSearch.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    this.statusFilter.valueChanges.pipe(startWith('ALL' as StatusFilter)),
  ]).pipe(
    map(([admins, query, status]) => {
      const q = (query || '').toLowerCase().trim();
      const s = (status || 'ALL').toUpperCase();

      const sorted = [...(admins || [])].sort(
        (a: any, b: any) => this.getAdminSortTime(b) - this.getAdminSortTime(a)
      );

      return sorted.filter((a: any) => {
        const name = (a?.name || '').toLowerCase();
        const email = (a?.email || '').toLowerCase();
        const adminStatus = (a?.status || '').toUpperCase();

        const matchesSearch = !q || name.includes(q) || email.includes(q);
        const matchesStatus = s === 'ALL' || adminStatus === s;

        return matchesSearch && matchesStatus;
      });
    }),
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
    // Create form
    this.form = this.fb.group({
      usercode: [{ value: '', disabled: true }],
      name: [''],
      email: [''],
      password: [''],
    });

    // Edit form
    this.editForm = this.fb.group({
      name: [''],
      email: [''],
    });

    this.vm$ = combineLatest([
      this.filteredAdmins$,
      this.page$.asObservable(),
    ]).pipe(
      map(([admins, page]) => {
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
    const nextCode = this.getNextAdminCode();
    this.form.reset({
      usercode: { value: nextCode, disabled: true },
      name: '',
      email: '',
      password: '',
    });
  }

  private getNextAdminCode(): string {
    const codes = this.adminsSnapshot.map((a) => a?.usercode);
    return this.nextSerialCode('AC', codes, 2);
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
    // ✅ clean payload (prevents 400 error)
    const payload = {
      name: this.editForm.value.name,
      email: this.editForm.value.email,
    };

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
     TOGGLE STATUS
  ====================== */

  isAdminStatusLoading(adminId: number): boolean {
    return this.adminStatusLoadingIds().has(adminId);
  }

  private setAdminStatusLoading(adminId: number, loading: boolean): void {
    const next = new Set(this.adminStatusLoadingIds());
    if (loading) next.add(adminId);
    else next.delete(adminId);
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

  private getAdminSortTime(admin: any): number {
    const createdAt = admin?.createdAt ?? admin?.created_at ?? admin?.createdOn;
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }

    const id = admin?.id;
    return typeof id === 'number' ? id : 0;
  }
}
