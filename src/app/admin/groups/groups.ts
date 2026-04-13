import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, combineLatest, debounceTime, distinctUntilChanged, map, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AdminService, Group, Activity } from '../admin.service';
import { AuthService } from '../../core/services/auth';
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
import { ZardSwitchComponent } from '@/shared/components/switch';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';

@Component({
  selector: 'app-groups',
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
    ZardIconComponent,
    ZardSwitchComponent,
    ZardComboboxComponent,
    LottieComponent,
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.css',
})
export class Groups {
  @ViewChild('groupDialog') groupDialog!: TemplateRef<any>;
  @ViewChild('tagDialog') tagDialog!: TemplateRef<any>;

  dialogRef!: ZardDialogRef<any>;
  groupForm!: FormGroup;
  tagForm!: FormGroup;

  options: AnimationOptions = {
    path: '/loading.json',
  };

  isLoading = true;
  private refresh$ = new Subject<void>();
  isSubmitting = false;
  isEditing = false;
  selectedGroupId: number | null = null;
  targetGroup: Group | null = null;
  readonly groupStatusLoadingIds = signal<Set<number>>(new Set());
  searchControl = new FormControl('');

  groups$!: Observable<Group[]>;
  pager$!: Observable<{
    items: Group[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  activities$!: Observable<Activity[]>;
  activityOptions$!: Observable<ZardComboboxOption[]>;

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  private currentUserId: number | null = null;
  private currentUserEmail: string | null = null;
  private assignedProjectIds = new Set<number>();
  private allowedActivityIds = new Set<number>();

  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private dialog: ZardDialogService,
    private authService: AuthService
  ) {
    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;
    this.currentUserEmail = currentUser?.email ? String(currentUser.email).toLowerCase() : null;

    const assignedProjects$ = this.adminService.getAssignedProjects(this.currentUserId || undefined);
    assignedProjects$.subscribe({
      next: (projects) => {
        this.assignedProjectIds = new Set((projects || []).map((p) => Number(p.id)));
      },
      error: () => {
        this.assignedProjectIds.clear();
      }
    });

    const status$ = this.statusFilter.valueChanges.pipe(
      startWith(this.statusFilter.value),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const search$ = this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const baseGroups$ = combineLatest([this.refresh$.pipe(startWith(void 0)), search$]).pipe(
      tap(() => {
        this.isLoading = true;
        this.goToPage(1);
      }),
      switchMap(() => this.adminService.getGroups()),
      map((groups) => (groups || []).filter((group) => this.isOwnedByCurrentAdmin(group))),
      map((groups) => {
        const query = (this.searchControl.value || '').toString().trim().toLowerCase();
        if (!query) return groups;

        const includes = (value: unknown) => String(value ?? '').toLowerCase().includes(query);
        return (groups || []).filter((g) => {
          if (includes(g.name)) return true;
          const tagged = (g.activities || []).map((ga: any) => ga?.activity?.name).filter(Boolean);
          return tagged.some((name) => includes(name));
        });
      }),
      tap(() => this.isLoading = false),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.groups$ = combineLatest([baseGroups$, status$]).pipe(
      map(([groups, status]) => {
        const normalized = (status ?? 'ALL').toString().toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE';
        if (normalized === 'ALL') return groups;
        return (groups || []).filter((g) => (g?.status ?? '').toString().toUpperCase() === normalized);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.pager$ = combineLatest([this.groups$, this.page$]).pipe(
      map(([groups, page]) => {
        const total = (groups || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (groups || []).slice(startIndex, endIndexExclusive);

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
        if (vm.page !== this.page$.getValue()) this.page$.next(vm.page);
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.activities$ = combineLatest([
      this.adminService.getActivities(),
      assignedProjects$.pipe(startWith([] as any[]))
    ]).pipe(
      map(([activities]) =>
        (activities || []).filter(
          (activity) => this.isActivityInAssignedProjects(activity) && activity.status === 'ACTIVE'
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.activityOptions$ = this.activities$.pipe(
      map(activities => (activities || []).map(a => ({
        label: a.name,
        value: a.id.toString()
      })))
    );
    this.activities$.subscribe({
      next: (activities) => {
        this.allowedActivityIds = new Set((activities || []).map((activity) => Number(activity.id)));
      },
      error: () => {
        this.allowedActivityIds.clear();
      }
    });
    this.initForms();
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

  private initForms() {
    this.groupForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-zA-Z\s]*$/), Validators.maxLength(50)]],
      minAge: [null],
      maxAge: [null],
      activityId: [''],
    });

    this.tagForm = this.fb.group({
      activityId: ['', Validators.required],
    });
  }

  openCreateDialog() {
    this.isEditing = false;
    this.groupForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: 'Create Beneficiary Group',
      zContent: this.groupDialog,
      zOkText: 'Create',
      zOnOk: () => {
        this.submitGroup();
        return false;
      },
    });
  }

  openEditDialog(group: Group) {
    this.isEditing = true;
    this.selectedGroupId = group.id;
    this.groupForm.patchValue(group);

    this.dialogRef = this.dialog.create({
      zTitle: 'Edit Group',
      zContent: this.groupDialog,
      zOkText: 'Update',
      zOnOk: () => {
        this.submitGroup();
        return false;
      },
    });
  }

  submitGroup() {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      toast.error('Please fill required fields');
      return;
    }

    const formValue = this.groupForm.value;
    const payload = {
      ...formValue,
      minAge: formValue.minAge != null && formValue.minAge !== '' ? Number(formValue.minAge) : 0,
      maxAge: formValue.maxAge != null && formValue.maxAge !== '' ? Number(formValue.maxAge) : 100,
    };

    if (formValue.activityId) {
      payload.activityId = Number(formValue.activityId);
    } else {
      delete payload.activityId;
    }

    this.isSubmitting = true;
    const obs = this.isEditing
      ? this.adminService.updateGroup(this.selectedGroupId!, payload)
      : this.adminService.createGroup(payload);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${this.isEditing ? 'updated' : 'created'} successfully`);
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        let errorMessage = 'Something went wrong';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  toggleGroupStatus(group: Group) {
    if (!this.canToggleStatus(group)) {
      toast.error('You can only activate/deactivate groups created by you');
      return;
    }

    const groupId = Number(group?.id);
    if (!Number.isFinite(groupId)) return;
    if (this.groupStatusLoadingIds().has(groupId)) return;

    const nextSet = new Set(this.groupStatusLoadingIds());
    nextSet.add(groupId);
    this.groupStatusLoadingIds.set(nextSet);

    const obs = group.status === 'ACTIVE'
      ? this.adminService.deactivateGroup(group.id)
      : this.adminService.activateGroup(group.id);

    obs.subscribe({
      next: () => {
        toast.success(`Group ${group.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
        this.refresh$.next();

        const done = new Set(this.groupStatusLoadingIds());
        done.delete(groupId);
        this.groupStatusLoadingIds.set(done);
      },
      error: (err) => {
        let errorMessage = 'Action failed';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);

        const done = new Set(this.groupStatusLoadingIds());
        done.delete(groupId);
        this.groupStatusLoadingIds.set(done);
      }
    });
  }

  isGroupStatusLoading(groupId: number): boolean {
    return this.groupStatusLoadingIds().has(groupId);
  }

  openTagDialog(group: Group) {
    if ((group?.status ?? '').toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Only active groups can be tagged');
      return;
    }
    this.targetGroup = group;
    this.tagForm.reset();

    this.dialogRef = this.dialog.create({
      zTitle: `Tag Activity to ${group.name}`,
      zContent: this.tagDialog,
      zOkText: 'Tag',
      zOnOk: () => {
        this.submitTag();
        return false;
      },
    });
  }

  submitTag() {
    if (this.tagForm.invalid) {
      toast.error('Please select an activity');
      return;
    }

    if (!this.targetGroup || (this.targetGroup?.status ?? '').toString().toUpperCase() !== 'ACTIVE') {
      toast.error('Only active groups can be tagged');
      return;
    }

    const activityId = Number(this.tagForm.value.activityId);
    if (!this.allowedActivityIds.has(activityId)) {
      toast.error('You can only tag activities from projects assigned to you');
      return;
    }

    this.isSubmitting = true;
    this.adminService.tagGroupWithActivity({
      groupId: this.targetGroup!.id,
      activityId
    }).subscribe({
      next: () => {
        toast.success('Activity tagged successfully');
        this.refresh$.next();
        this.dialogRef.close();
        this.isSubmitting = false;
      },
      error: (err) => {
        let errorMessage = 'Tagging failed';
        if (err.error?.message) {
          errorMessage = Array.isArray(err.error.message) ? err.error.message[0] : err.error.message;
        }
        toast.error(errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  canToggleStatus(group: Group): boolean {
    return this.isOwnedByCurrentAdmin(group);
  }

  private isActivityInAssignedProjects(activity: Activity): boolean {
    if (!activity?.projectId) return false;
    return this.assignedProjectIds.has(Number(activity.projectId));
  }

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }

  private isOwnedByCurrentAdmin(entity: any): boolean {
    const creatorId = this.getCreatorId(entity);
    if (!!creatorId && !!this.currentUserId && creatorId === this.currentUserId) {
      return true;
    }
    const creatorEmail = entity?.creator?.email || entity?.createdBy?.email;
    if (!creatorEmail || !this.currentUserEmail) {
      return false;
    }
    return String(creatorEmail).toLowerCase() === this.currentUserEmail;
  }

  getErrorMessage(err: any, fallback: string): string {
    if (err instanceof FormGroup || err instanceof FormControl) {
      if (err.valid || (!err.touched && !err.dirty)) return '';
      const fieldName = (fallback || '').toString().toLowerCase();
      if (err.hasError('required')) return `${fallback} is required`;
      if (err.hasError('pattern')) {
        if (fieldName.includes('name')) return 'Only letters and spaces are allowed';
        return `Invalid ${fallback} format`;
      }
      if (err.hasError('maxlength')) {
        const max = err.getError('maxlength')?.requiredLength;
        return `${fallback} cannot exceed ${max} characters`;
      }
      return '';
    }
    const msg = err?.error?.message;
    return Array.isArray(msg) ? msg[0] : (msg || fallback);
  }
}
