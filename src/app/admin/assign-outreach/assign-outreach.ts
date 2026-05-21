import { Component, OnInit, signal, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AssignOutreachService, UserSummary } from './assign-outreach.service';
import { toast } from 'ngx-sonner';

import { ZardButtonComponent } from '@/shared/components/button';
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
  outreachWorkers: UserSummary[] = [];
  managers: UserSummary[] = [];
  managerOptions: ZardComboboxOption[] = [];

  loading = signal(true);
  assignLoading = signal(false);

  assignForm!: FormGroup;
  targetWorker: UserSummary | null = null;
  dialogRef!: ZardDialogRef<any>;

  @ViewChild('assignDialog') assignDialog!: TemplateRef<any>;

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
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.assignOutreachService.getOutreachWorkers().subscribe({
      next: (workers) => {
        this.outreachWorkers = workers;
        this.assignOutreachService.getManagers().subscribe({
          next: (managers) => {
            this.managers = managers;
            this.managerOptions = managers.map(m => ({
              label: `${m.name} (${m.usercode || m.id})`,
              value: m.id.toString()
            }));
            this.loading.set(false);
          },
          error: () => {
            toast.error('Failed to load managers');
            this.loading.set(false);
          }
        });
      },
      error: () => {
        toast.error('Failed to load outreach workers');
        this.loading.set(false);
      }
    });
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
        this.loadData();
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
