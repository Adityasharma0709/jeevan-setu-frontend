import { Component, OnInit, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, Subject, startWith, debounceTime, distinctUntilChanged, switchMap, map, tap, shareReplay, of } from 'rxjs';
import { AssignOutreachService, UserSummary } from './assign-outreach.service';
import { toast } from 'ngx-sonner';

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
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardDropdownImports } from '@/shared/components/dropdown/dropdown.imports';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-assign-outreach',
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
    ZardComboboxComponent,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    ...ZardDropdownImports,
  ],
  templateUrl: './assign-outreach.html',
  styleUrl: './assign-outreach.css',
})
export class AssignOutreachComponent implements OnInit {
  allOutreachWorkers: UserSummary[] = [];
  managers: UserSummary[] = [];
  managerOptions: ZardComboboxOption[] = [];

  loading = signal(true);
  assignLoading = signal(false);

  assignForm!: FormGroup;
  targetWorker: UserSummary | null = null;
  dialogRef!: ZardDialogRef<any>;

  @ViewChild('assignDialog') assignDialog!: TemplateRef<any>;

  // Search & Pagination
  searchControl = new FormControl('');
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;
  private refresh$ = new Subject<void>();

  pager$!: {
    items: UserSummary[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  };

  pagedWorkers: UserSummary[] = [];
  currentPage = 1;
  totalPages = 1;
  totalWorkers = 0;
  fromItem = 0;
  toItem = 0;

  constructor(
    private assignOutreachService: AssignOutreachService,
    private dialog: ZardDialogService,
    private fb: FormBuilder
  ) {
    this.assignForm = this.fb.group({
      managerId: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadManagers();
    this.setupPagination();
  }

  loadManagers() {
    this.assignOutreachService.getManagers().subscribe({
      next: (managers) => {
        this.managers = managers;
        this.managerOptions = managers.map(m => ({
          label: `${m.name} (${m.usercode || m.id})`,
          value: m.id.toString()
        }));
      },
      error: () => toast.error('Failed to load managers')
    });
  }

  setupPagination() {
    this.loading.set(true);
    this.assignOutreachService.getOutreachWorkers().subscribe({
      next: (workers) => {
        this.allOutreachWorkers = workers;
        this.loading.set(false);
        this.applyFilters();

        // React to search changes
        this.searchControl.valueChanges.pipe(
          debounceTime(300),
          distinctUntilChanged()
        ).subscribe(() => {
          this.goToPage(1);
          this.applyFilters();
        });
      },
      error: () => {
        toast.error('Failed to load outreach workers');
        this.loading.set(false);
      }
    });
  }

  applyFilters() {
    const query = (this.searchControl.value || '').toLowerCase();
    const filtered = this.allOutreachWorkers.filter(w =>
      w.name.toLowerCase().includes(query) ||
      w.email.toLowerCase().includes(query) ||
      (w.usercode || '').toLowerCase().includes(query) ||
      (w.createdByAdmin?.name || '').toLowerCase().includes(query)
    );

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    const safePage = Math.min(Math.max(1, this.currentPage), totalPages);
    const startIndex = (safePage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, total);

    this.totalWorkers = total;
    this.totalPages = totalPages;
    this.currentPage = safePage;
    this.fromItem = total === 0 ? 0 : startIndex + 1;
    this.toItem = total === 0 ? 0 : endIndex;
    this.pagedWorkers = filtered.slice(startIndex, endIndex);
    this.lastPage = safePage;
    this.lastTotalPages = totalPages;
  }

  goToPage(page: number) {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
    this.applyFilters();
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  openAssignDialog(worker: UserSummary) {
    this.targetWorker = worker;
    this.assignForm.reset({ managerId: null });
    this.assignLoading.set(false);

    this.dialogRef = this.dialog.create({
      zTitle: `Assign Manager to ${worker.name}`,
      zContent: this.assignDialog,
      zOkText: 'Save',
      zOkLoading: this.assignLoading,
      zWidth: '500px',
      zOnOk: () => {
        this.submitAssignment();
        return false;
      },
      zOnCancel: () => {
        this.targetWorker = null;
      },
    });
  }

  submitAssignment() {
    if (this.assignForm.invalid || !this.targetWorker) {
      toast.error('Please select a manager');
      return;
    }

    const managerId = Number(this.assignForm.value.managerId);
    this.assignLoading.set(true);

    this.assignOutreachService.assignManager(this.targetWorker.id, managerId).subscribe({
      next: () => {
        toast.success('Manager assigned successfully');
        this.assignLoading.set(false);
        this.dialogRef.close();
        this.loading.set(true);
        this.assignOutreachService.getOutreachWorkers().subscribe({
          next: (workers) => {
            this.allOutreachWorkers = workers;
            this.loading.set(false);
            this.applyFilters();
          },
          error: () => {
            this.loading.set(false);
            toast.error('Failed to refresh data');
          }
        });
      },
      error: () => {
        toast.error('Failed to assign manager');
        this.assignLoading.set(false);
      }
    });
  }

  getManagerName(worker: UserSummary): string {
    if (worker.createdByAdmin) {
      return worker.createdByAdmin.name;
    }
    return 'Unassigned';
  }
}
