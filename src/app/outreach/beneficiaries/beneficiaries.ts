import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, Subject, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective, ZardSelectDirective } from '@/shared/components/input';
import {
  ZardTableBodyComponent,
  ZardTableCellComponent,
  ZardTableComponent,
  ZardTableHeadComponent,
  ZardTableHeaderComponent,
  ZardTableRowComponent,
} from '@/shared/components/table';

import { Beneficiary, CreateBeneficiaryPayload, OutreachService } from '../outreach.service';

@Component({
  selector: 'app-beneficiaries',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardDialogModule,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardIconComponent,
    ZardInputDirective,
    ZardSelectDirective,
    ZardTableBodyComponent,
    ZardTableCellComponent,
    ZardTableComponent,
    ZardTableHeadComponent,
    ZardTableHeaderComponent,
    ZardTableRowComponent,
    LottieComponent,
  ],
  templateUrl: './beneficiaries.html',
  styleUrl: './beneficiaries.css',
})
export class Beneficiaries {
  @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;

  private outreachService = inject(OutreachService);
  private fb = inject(FormBuilder);
  private dialog = inject(ZardDialogService);
  private authService = inject(AuthService);

  private refresh$ = new Subject<void>();
  private currentUserId = Number(this.authService.getCurrentUser()?.sub) || undefined;

  dialogRef!: ZardDialogRef<any>;
  selectedBeneficiary: Beneficiary | null = null;
  options: AnimationOptions = { path: '/loading.json' };

  showCreateForm = false;
  isSubmitting = false;

  searchControl = new FormControl('');

  createForm: FormGroup = this.fb.group({
    projectId: ['', Validators.required],
    locationId: ['', Validators.required],
    mobileNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    name: ['', Validators.required],
    gender: ['', Validators.required],
    guardianName: ['', Validators.required],
    dateOfBirth: ['', Validators.required],
    maritalStatus: ['Single'],
    dateOfMarriage: [''],
    womanAgeAtMarriage: [''],
    husbandAgeAtMarriage: [''],
    qualification: ['', Validators.required],
    religion: ['', Validators.required],
    caste: ['', Validators.required],
    monthlyIncome: ['', [Validators.required, Validators.min(0)]],
    economicStatus: ['', Validators.required],
    primaryIncomeSource: ['', Validators.required],
    employmentStatus: ['', Validators.required],
  });

  updateForm: FormGroup = this.fb.group({
    mobileNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    reason: ['', Validators.required],
  });

  projects$ = this.outreachService.getAssignedProjects(this.currentUserId).pipe(
    startWith([])
  );

  locations$ = this.createForm.get('projectId')!.valueChanges.pipe(
    startWith(this.createForm.get('projectId')!.value),
    switchMap((projectId) => (projectId ? this.outreachService.getLocationsByProject(Number(projectId)) : of([])))
  );

  beneficiaries$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.searchControl.valueChanges.pipe(startWith(''), debounceTime(250), distinctUntilChanged()),
  ]).pipe(
    switchMap(([_, search]) => this.outreachService.getBeneficiaries((search || '').trim())),
    map((rows) => rows || [])
  );

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (this.showCreateForm) {
      this.createForm.reset({ maritalStatus: 'Single' });
    }
  }

  isMarried(): boolean {
    return String(this.createForm.get('maritalStatus')?.value || '').toLowerCase() === 'married';
  }

  openUpdateDialog(beneficiary: Beneficiary) {
    this.selectedBeneficiary = beneficiary;
    this.updateForm.reset({
      mobileNumber: beneficiary.mobileNumber,
      reason: '',
    });

    this.dialogRef = this.dialog.create({
      zTitle: `Request update for ${beneficiary.name}`,
      zContent: this.updateDialog,
      zOkText: 'Submit',
      zOnOk: () => {
        this.submitUpdateRequest();
        return false;
      },
    });
  }

  submitUpdateRequest() {
    if (!this.selectedBeneficiary || this.updateForm.invalid) {
      this.updateForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.outreachService
      .requestBeneficiaryUpdate(this.selectedBeneficiary.id, this.updateForm.getRawValue())
      .subscribe({
        next: () => {
          toast.success('Update request submitted for manager approval');
          this.dialogRef?.close();
          this.isSubmitting = false;
        },
        error: (err) => {
          toast.error(err?.error?.message || 'Failed to submit update request');
          this.isSubmitting = false;
        },
      });
  }

  submitCreate() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      toast.error('Please fill all required fields');
      return;
    }

    const raw = this.createForm.getRawValue();
    const payload: CreateBeneficiaryPayload = {
      projectId: Number(raw.projectId),
      locationId: Number(raw.locationId),
      mobileNumber: String(raw.mobileNumber),
      name: String(raw.name),
      gender: String(raw.gender),
      guardianName: String(raw.guardianName),
      dateOfBirth: String(raw.dateOfBirth),
      maritalStatus: raw.maritalStatus ? String(raw.maritalStatus) : undefined,
      dateOfMarriage: raw.dateOfMarriage ? String(raw.dateOfMarriage) : undefined,
      womanAgeAtMarriage: raw.womanAgeAtMarriage ? Number(raw.womanAgeAtMarriage) : undefined,
      husbandAgeAtMarriage: raw.husbandAgeAtMarriage ? Number(raw.husbandAgeAtMarriage) : undefined,
      qualification: String(raw.qualification),
      religion: String(raw.religion),
      caste: String(raw.caste),
      monthlyIncome: Number(raw.monthlyIncome),
      economicStatus: String(raw.economicStatus),
      primaryIncomeSource: String(raw.primaryIncomeSource),
      employmentStatus: String(raw.employmentStatus),
    };

    this.isSubmitting = true;
    this.outreachService.createBeneficiary(payload).subscribe({
      next: () => {
        toast.success('Beneficiary created successfully');
        this.refresh$.next();
        this.showCreateForm = false;
        this.createForm.reset({ maritalStatus: 'Single' });
        this.isSubmitting = false;
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to create beneficiary');
        this.isSubmitting = false;
      },
    });
  }
}
