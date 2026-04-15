import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toast } from 'ngx-sonner';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardInputDirective } from '@/shared/components/input';

import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { OutreachService, Beneficiary } from '../outreach.service';

@Component({
  selector: 'app-request-update',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardInputDirective,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    ZardComboboxComponent
  ],
  templateUrl: './request-update.html',
})
export class RequestUpdate implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private outreachService = inject(OutreachService);

  beneficiary: Beneficiary | null = null;
  loading = true;
  isSubmitting = false;

  form: FormGroup = this.fb.group({
    name: [''],
    mobileNumber: ['', [Validators.pattern('^[0-9]{10}$')]],
    gender: [''],
    guardianName: [''],
    dateOfBirth: [''],
    maritalStatus: [''],
    dateOfMarriage: [''],
    womanAgeAtMarriage: [''],
    husbandAgeAtMarriage: [''],
    qualification: [''],
    religion: [''],
    caste: [''],
    monthlyIncome: [''],
    economicStatus: [''],
    primaryIncomeSource: [''],
    employmentStatus: [''],
  });

  readonly genderOptions: ZardComboboxOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }
  ];

  readonly maritalStatusOptions: ZardComboboxOption[] = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' },
    { value: 'Widowed', label: 'Widowed' },
    { value: 'Divorced', label: 'Divorced' }
  ];

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    const stateData = history.state?.beneficiary;

    if (stateData) {
      this.beneficiary = stateData;
      this.patchForm(stateData);
      this.loading = false;
    } else {
      this.outreachService.getBeneficiary(id).subscribe({
        next: (b) => {
          this.beneficiary = b;
          this.patchForm(b);
          this.loading = false;
        },
        error: () => {
          toast.error('Beneficiary not found');
          this.router.navigate(['/outreach/beneficiaries']);
        }
      });
    }
  }

  isMarried(): boolean {
    return String(this.form.get('maritalStatus')?.value || '').toLowerCase() === 'married';
  }

  private toInputDate(value: string) {
    try { return new Date(value).toISOString().split('T')[0]; } catch { return ''; }
  }

  private patchForm(b: Beneficiary) {
    this.form.patchValue({
      name: b.name || '',
      mobileNumber: b.mobileNumber || '',
      gender: b.gender || '',
      guardianName: b.guardianName || '',
      dateOfBirth: b.dateOfBirth ? this.toInputDate(b.dateOfBirth) : '',
      maritalStatus: b.maritalStatus || '',
      dateOfMarriage: b.dateOfMarriage ? this.toInputDate(b.dateOfMarriage) : '',
      womanAgeAtMarriage: b.womanAgeAtMarriage ?? '',
      husbandAgeAtMarriage: b.husbandAgeAtMarriage ?? '',
      qualification: b.qualification || '',
      religion: b.religion || '',
      caste: b.caste || '',
      monthlyIncome: b.monthlyIncome ?? '',
      economicStatus: b.economicStatus || '',
      primaryIncomeSource: b.primaryIncomeSource || '',
      employmentStatus: b.employmentStatus || '',
    });
  }

  goBack() { history.back(); }

  submit() {
    if (!this.beneficiary) return;
    const raw = this.form.getRawValue();
    const b = this.beneficiary;
    const changes: Record<string, any> = {};

    if (raw.name && raw.name !== b.name) changes['name'] = String(raw.name);
    if (raw.mobileNumber && raw.mobileNumber !== b.mobileNumber) changes['mobileNumber'] = String(raw.mobileNumber);
    const dob = b.dateOfBirth ? this.toInputDate(b.dateOfBirth) : '';
    if (raw.dateOfBirth && raw.dateOfBirth !== dob) changes['dateOfBirth'] = new Date(raw.dateOfBirth).toISOString();
    if (raw.gender && raw.gender !== b.gender) changes['gender'] = String(raw.gender);
    if (raw.guardianName && raw.guardianName !== b.guardianName) changes['guardianName'] = String(raw.guardianName);
    if (raw.qualification && raw.qualification !== b.qualification) changes['qualification'] = String(raw.qualification);
    if (raw.religion && raw.religion !== b.religion) changes['religion'] = String(raw.religion);
    if (raw.caste && raw.caste !== b.caste) changes['caste'] = String(raw.caste);
    if (raw.monthlyIncome !== '' && Number(raw.monthlyIncome) !== Number(b.monthlyIncome)) changes['monthlyIncome'] = Number(raw.monthlyIncome);
    if (raw.primaryIncomeSource && raw.primaryIncomeSource !== b.primaryIncomeSource) changes['primaryIncomeSource'] = String(raw.primaryIncomeSource);
    if (raw.economicStatus && raw.economicStatus !== b.economicStatus) changes['economicStatus'] = String(raw.economicStatus);
    if (raw.employmentStatus && raw.employmentStatus !== b.employmentStatus) changes['employmentStatus'] = String(raw.employmentStatus);
    if (raw.maritalStatus && raw.maritalStatus !== b.maritalStatus) changes['maritalStatus'] = String(raw.maritalStatus);

    if (this.isMarried()) {
      const dom = b.dateOfMarriage ? this.toInputDate(b.dateOfMarriage) : '';
      if (raw.dateOfMarriage && raw.dateOfMarriage !== dom) changes['dateOfMarriage'] = new Date(raw.dateOfMarriage).toISOString();
      if (raw.womanAgeAtMarriage !== '' && Number(raw.womanAgeAtMarriage) !== Number(b.womanAgeAtMarriage)) changes['womanAgeAtMarriage'] = Number(raw.womanAgeAtMarriage);
      if (raw.husbandAgeAtMarriage !== '' && Number(raw.husbandAgeAtMarriage) !== Number(b.husbandAgeAtMarriage)) changes['husbandAgeAtMarriage'] = Number(raw.husbandAgeAtMarriage);
    }

    if (!Object.keys(changes).length) {
      toast.error('No changes detected');
      return;
    }

    this.isSubmitting = true;
    this.outreachService.requestBeneficiaryUpdate(this.beneficiary.id, changes).subscribe({
      next: () => {
        toast.success('Update request submitted for manager approval');
        this.router.navigate(['/outreach/beneficiary', this.beneficiary!.id]);
      },
      error: (err: any) => {
        toast.error(err?.error?.message || 'Failed to submit update');
        this.isSubmitting = false;
      },
    });
  }
}
