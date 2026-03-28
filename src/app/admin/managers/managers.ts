import { Component, TemplateRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, Subject, startWith, switchMap, combineLatest, debounceTime, distinctUntilChanged, tap, of, map, shareReplay } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

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
    ZardIconComponent,
    LottieComponent,
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
  statusFilter = new FormControl<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL', { nonNullable: true });

  private refresh$ = new Subject<void>();
  isEditing = false;
  selectedManagerId: number | null = null;
  options: AnimationOptions = { path: '/loading.json' };
  targetManager: User | null = null;

  managers$!: Observable<User[]>;
  pager$!: Observable<{
    items: User[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  }>;
  projects$!: Observable<any[]>;
  locations$!: Observable<any[]>;
  managerLocations$!: Observable<any[]>;
  private projectsCache: any[] = [];
  private currentUserId: number | null = null;
  readonly managerStatusLoadingIds = signal<Set<number>>(new Set());

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private fb: FormBuilder,
    private managersService: ManagersService,
    private dialog: ZardDialogService,
    private authService: AuthService
  ) {
    const status$ = this.statusFilter.valueChanges.pipe(
      startWith(this.statusFilter.value),
      distinctUntilChanged(),
      tap(() => this.goToPage(1)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const baseManagers$ = combineLatest([
      this.refresh$.pipe(startWith(void 0)),
      this.searchControl.valueChanges.pipe(
        startWith(''),
        debounceTime(300),
        distinctUntilChanged()
      )
    ]).pipe(
      tap(() => this.goToPage(1)),
      switchMap(([_, query]) => this.managersService.findAll(query || '')),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.managers$ = combineLatest([baseManagers$, status$]).pipe(
      map(([managers, status]) => {
        const normalized = (status ?? 'ALL').toString().toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE';
        if (normalized === 'ALL') return managers || [];
        return (managers || []).filter((m) => (m?.status ?? '').toString().toUpperCase() === normalized);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.pager$ = combineLatest([this.managers$, this.page$]).pipe(
      map(([managers, page]) => {
        const total = (managers || []).length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = (managers || []).slice(startIndex, endIndexExclusive);

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

    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = Number(currentUser?.sub) || null;
    this.projects$ = this.managersService.getProjects(currentUser?.sub).pipe(
      tap((projects) => {
        this.projectsCache = Array.isArray(projects) ? projects : [];
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
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
    if (selectedProjectId) {
      const selectedProject = this.projectsCache.find((p) => Number(p?.id) === selectedProjectId);
      if (!selectedProject) {
        toast.error('Selected project is inactive or unavailable');
        return;
      }
    }
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
    const managerId = Number(manager?.id);
    if (!Number.isFinite(managerId)) return;
    if (this.managerStatusLoadingIds().has(managerId)) return;

    const nextSet = new Set(this.managerStatusLoadingIds());
    nextSet.add(managerId);
    this.managerStatusLoadingIds.set(nextSet);

    const nextStatus = manager.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.managersService.updateStatus(manager.id, nextStatus).subscribe({
      next: () => {
        toast.success(nextStatus === 'ACTIVE' ? 'Manager activated' : 'Manager deactivated');
        this.refresh$.next();

        const done = new Set(this.managerStatusLoadingIds());
        done.delete(managerId);
        this.managerStatusLoadingIds.set(done);
      },
      error: (err) => {
        toast.error(this.getErrorMessage(err, 'Failed to update status'));

        const done = new Set(this.managerStatusLoadingIds());
        done.delete(managerId);
        this.managerStatusLoadingIds.set(done);
      }
    });
  }

  isManagerStatusLoading(managerId: number): boolean {
    return this.managerStatusLoadingIds().has(managerId);
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
    const projectIdNum = Number(projectId);
    const locationIdNum = Number(locationId);

    if (!Number.isFinite(projectIdNum) || !Number.isFinite(locationIdNum)) {
      toast.error('Please select both project and location');
      return;
    }

    const selectedProject = this.projectsCache.find((p) => Number(p?.id) === projectIdNum);
    if (!selectedProject) {
      toast.error('Selected project is inactive or unavailable');
      return;
    }

    this.managersService.assignProject(this.targetManager!.id, projectIdNum, locationIdNum).subscribe({
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
