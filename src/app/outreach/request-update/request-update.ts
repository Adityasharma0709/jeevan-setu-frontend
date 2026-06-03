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
  readonly economicStatusOptions = this.mapStringsToOptions(['AAY', 'PHH', 'Others']);
  readonly primaryIncomeSourceOptions = this.mapStringsToOptions([
    'Agriculture', 'Daily Labour', 'Small Business', 'Government Service', 'Private Service', 'Pension / Remittance', 'Other',
  ]);
  readonly employmentStatusOptions = this.mapStringsToOptions(['Working', 'Not-Working', 'Daily-Wage-Earner', 'Self-Employed']);

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

  private parseDateStr(dateStr: string): Date | null {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const p = dateStr.split('/');
      if (p.length === 3) {
        const day = Number(p[0]), month = Number(p[1]) - 1, year = Number(p[2]);
        const d = new Date(year, month, day);
        if (d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) return d;
      }
    } else {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  private calculateAge(dobStr: string): number {
    if (!dobStr) return 0;
    const dob = this.parseDateStr(dobStr) || new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  private toIsoDateString(dateStr: string): string | null {
    const date = this.parseDateStr(dateStr);
    return date ? date.toISOString() : null;
  }

  /** Convert an ISO date string from DB to DD/MM/YYYY for display */
  private toDDMMYYYY(value: string): string {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }

  formatDateInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length > 4) formatted = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);
    else if (val.length > 2) formatted = val.substring(0, 2) + '/' + val.substring(2, 4);
    this.form.get(controlName)?.setValue(formatted, { emitEvent: false });
  }

  openPicker(picker: HTMLInputElement) {
    try { picker.showPicker(); } catch { picker.focus(); }
  }

  getNativeDateValue(controlName: string): string {
    const val = this.form.get(controlName)?.value;
    const d = this.parseDateStr(val);
    if (d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
  }

  onNativeDateChange(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const parts = input.value.split('-');
      if (parts.length === 3) {
        this.form.get(controlName)?.setValue(`${parts[2]}/${parts[1]}/${parts[0]}`);
        this.form.get(controlName)?.markAsTouched();
      }
    }
  }

  private patchForm(b: Beneficiary) {
    const hasPriorityData = !!(b.guardianName || b.qualification || b.religion || b.caste);
    const type = hasPriorityData ? 'Priority' : 'General';

    this.form.patchValue({
      beneficiaryType: type,
      name: b.name || '',
      mobileNumber: b.mobileNumber || '',
      gender: b.gender || '',
      guardianName: b.guardianName || '',
      // Convert ISO DB date → DD/MM/YYYY for the custom date picker
      dateOfBirth: b.dateOfBirth ? this.toDDMMYYYY(b.dateOfBirth) : '',
      age: b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : '',
      maritalStatus: b.maritalStatus || '',
      dateOfMarriage: b.dateOfMarriage ? this.toDDMMYYYY(b.dateOfMarriage) : '',
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
    
    // DOB / Age handling - always normalize to ISO before submit
    if (this.isPriority) {
      const currentDob = b.dateOfBirth ? this.toDDMMYYYY(b.dateOfBirth) : '';
      if (raw.dateOfBirth && raw.dateOfBirth !== currentDob) {
        const isoDob = this.toIsoDateString(raw.dateOfBirth);
        if (isoDob) changes['dateOfBirth'] = isoDob;
      }
    } else if (raw.age !== '') {
      const currentAge = b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : -1;
      if (Number(raw.age) !== currentAge) {
        const y = new Date().getFullYear() - Number(raw.age);
        changes['dateOfBirth'] = new Date(y, 0, 1).toISOString();
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
        const currentDom = b.dateOfMarriage ? this.toDDMMYYYY(b.dateOfMarriage) : '';
        if (raw.dateOfMarriage && raw.dateOfMarriage !== currentDom) {
          const isoDom = this.toIsoDateString(raw.dateOfMarriage);
          if (isoDom) changes['dateOfMarriage'] = isoDom;
        }
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
        setTimeout(() => {
          const msg = err?.error?.message;
          const errorMsg = Array.isArray(msg) ? msg[0] : (msg || 'Failed to submit update');
          toast.error(errorMsg);
          this.isSubmitting = false;
        }, 0);
      },
    });
  }
}
