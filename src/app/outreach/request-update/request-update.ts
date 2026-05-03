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
    beneficiaryType: ['General', Validators.required],
    name: [''],
    mobileNumber: ['', [Validators.pattern('^[0-9]{10}$')]],
    gender: [''],
    guardianName: [''],
    dateOfBirth: [''],
    age: [''],
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

  private mapStringsToOptions = (opts: string[]): ZardComboboxOption[] => 
    opts.map(o => ({ value: o, label: o }));

  readonly qualificationOptions = this.mapStringsToOptions([
    'No Formal Education', 'Primary (Class 1–5)', 'Upper Primary (Class 6–8)',
    'Secondary (Class 9–10)', 'Senior Secondary (Class 11–12)', 'Diploma / ITI',
    'Graduate', 'Post Graduate', 'Other',
  ]);

  readonly religionOptions = this.mapStringsToOptions(['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other']);
  readonly casteOptions    = this.mapStringsToOptions(['General', 'OBC', 'SC', 'ST', 'Other']);
  readonly economicStatusOptions = this.mapStringsToOptions(['APL', 'BPL']);
  readonly primaryIncomeSourceOptions = this.mapStringsToOptions([
    'Agriculture', 'Daily Labour', 'Small Business', 'Government Service', 'Private Service', 'Pension / Remittance', 'Other',
  ]);
  readonly employmentStatusOptions = this.mapStringsToOptions(['Employed', 'Unemployed', 'Self-Employed', 'Student']);

  readonly beneficiaryTypeOptions: ZardComboboxOption[] = [
    { value: 'Priority', label: 'Priority' },
    { value: 'Stakeholder', label: 'Stakeholder' },
    { value: 'General', label: 'General' }
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

  get isPriority(): boolean {
    return this.form.get('beneficiaryType')?.value === 'Priority';
  }

  private calculateAge(dobStr: string): number {
    if (!dobStr) return 0;
    const dob = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  private toInputDate(value: string) {
    try { return new Date(value).toISOString().split('T')[0]; } catch { return ''; }
  }

  private patchForm(b: Beneficiary) {
    // Try to guess type based on data presence
    const hasPriorityData = !!(b.guardianName || b.qualification || b.religion || b.caste);
    const type = hasPriorityData ? 'Priority' : 'General';

    this.form.patchValue({
      beneficiaryType: type,
      name: b.name || '',
      mobileNumber: b.mobileNumber || '',
      gender: b.gender || '',
      guardianName: b.guardianName || '',
      dateOfBirth: b.dateOfBirth ? this.toInputDate(b.dateOfBirth) : '',
      age: b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : '',
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
    if (raw.gender && raw.gender !== b.gender) changes['gender'] = String(raw.gender);
    
    // DOB / Age handling
    if (this.isPriority) {
      const dob = b.dateOfBirth ? this.toInputDate(b.dateOfBirth) : '';
      if (raw.dateOfBirth && raw.dateOfBirth !== dob) changes['dateOfBirth'] = new Date(raw.dateOfBirth).toISOString();
    } else if (raw.age !== '') {
      const currentAge = b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : -1;
      if (Number(raw.age) !== currentAge) {
        changes['dateOfBirth'] = new Date(new Date().getFullYear() - Number(raw.age), 0, 1).toISOString();
      }
    }

    if (this.isPriority) {
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
        const msg = err?.error?.message;
        const errorMsg = Array.isArray(msg) ? msg[0] : (msg || 'Failed to submit update');
        toast.error(errorMsg);
        this.isSubmitting = false;
      },
    });
  }
}
