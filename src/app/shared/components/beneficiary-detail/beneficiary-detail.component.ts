import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject, ViewChild, TemplateRef, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { toast } from 'ngx-sonner';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '@/core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { ZardDialogService } from '@/shared/components/dialog';

@Component({
  selector: 'z-beneficiary-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ZardButtonComponent,
    ZardIconComponent,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    ZardComboboxComponent,
    LottieComponent,
  ],
  templateUrl: './beneficiary-detail.component.html',
})
export class ZardBeneficiaryDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private dialog = inject(ZardDialogService);
  private viewContainerRef = inject(ViewContainerRef);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @ViewChild('familyModalTemplate') familyModalTemplate!: TemplateRef<any>;
  private dialogRef: any;

  readonly isManager = true; // Enforce read-only details layout (hide all edits)

  // Data
  beneficiary: any = null;
  activityReports: any[] = [];
  reportsLoading = false;

  // Loader
  options: AnimationOptions = { path: '/loading.json' };

  // UI state
  loading = true;
  activeTab: 'detail' | 'family' | 'history' = 'detail';

  showFamilyModal = false;
  savingFamily = false;
  familyForm = {
    name: '',
    relationship: '',
    dateOfBirth: '',
    gender: '',
    schoolingStatus: '',
    employmentStatus: '',
    qualification: ''
  };

  get familyAge(): number {
    const dob = this.parseDateStr(this.familyForm.dateOfBirth);
    if (!dob) return 0;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : 0;
  }

  // Family Member Options
  relationshipOptions: ZardComboboxOption[] = [
    { value: 'Son/Daughter', label: 'Son/Daughter' },
    { value: 'Spouse', label: 'Spouse' },
    { value: 'Parents/In-Laws', label: 'Parents/In-Laws' },
    { value: 'Others', label: 'Others' }
  ];

  genderOptions: ZardComboboxOption[] = [
    { value: 'Female', label: 'Female' },
    { value: 'Male', label: 'Male' },
    { value: 'Other', label: 'Other' }
  ];

  qualificationOptions: ZardComboboxOption[] = [
    { value: 'No Formal Education', label: 'No Formal Education' },
    { value: 'Primary (Class 1–5)', label: 'Primary (Class 1–5)' },
    { value: 'Upper Primary (Class 6–8)', label: 'Upper Primary (Class 6–8)' },
    { value: 'Secondary (Class 9–10)', label: 'Secondary (Class 9–10)' },
    { value: 'Senior Secondary (Class 11–12)', label: 'Senior Secondary (Class 11–12)' },
    { value: 'Diploma / ITI', label: 'Diploma / ITI' },
    { value: 'Graduate', label: 'Graduate' },
    { value: 'Post Graduate', label: 'Post Graduate' },
  ];

  qualificationStudyingOptions: ZardComboboxOption[] = [
    { value: 'Primary (Class 1–5)', label: 'Primary (Class 1–5)' },
    { value: 'Upper Primary (Class 6–8)', label: 'Upper Primary (Class 6–8)' },
    { value: 'Secondary (Class 9–10)', label: 'Secondary (Class 9–10)' },
    { value: 'Senior Secondary (Class 11–12)', label: 'Senior Secondary (Class 11–12)' },
    { value: 'Diploma / ITI', label: 'Diploma / ITI' },
    { value: 'Graduate', label: 'Graduate' },
    { value: 'Post Graduate', label: 'Post Graduate' },
  ];

  schoolingOptions: ZardComboboxOption[] = [
    { value: 'Currently studying', label: 'Currently Studying' },
    { value: 'Not studying', label: 'Not Studying' },
  ];

  employmentOptions: ZardComboboxOption[] = [
    { value: 'Employed', label: 'Employed' },
    { value: 'Unemployed', label: 'Unemployed' },
    { value: 'Self-Employed', label: 'Self-Employed' },
    { value: 'Student', label: 'Student' },
    { value: 'Home Maker', label: 'Home Maker' }
  ];

  get filteredEmploymentOptions(): ZardComboboxOption[] {
    if (this.familyForm.schoolingStatus === 'Currently studying') {
      return this.employmentOptions.filter(opt => opt.value === 'Student');
    }
    return this.employmentOptions;
  }

  get beneficiaryAge(): number | string {
    if (!this.beneficiary?.dateOfBirth) return '—';
    const dob = new Date(this.beneficiary.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  get isPriority(): boolean {
    if (!this.beneficiary) return false;
    return !!(this.beneficiary.guardianName || this.beneficiary.qualification || this.beneficiary.religion || this.beneficiary.caste);
  }

  get backRoute(): string {
    const url = this.router.url;
    if (url.includes('/outreach')) return '/outreach/beneficiaries';
    if (url.includes('/manager')) return '/manager/beneficiaries';
    return '/analyst/beneficiary';
  }

  get backLabel(): string {
    const url = this.router.url;
    if (url.includes('/outreach') || url.includes('/manager')) return 'Beneficiaries';
    return 'Beneficiary Reports';
  }

  get rolePrefix(): string {
    const url = this.router.url;
    if (url.includes('/outreach')) return 'outreach';
    if (url.includes('/manager')) return 'manager';
    if (url.includes('/admin')) return 'admin';
    return 'analyst';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.params['id'];
    if (!id) {
      this.loading = false;
      return;
    }

    const stateData = history.state?.beneficiary;
    if (stateData?.id === Number(id) && stateData.uid) {
      this.beneficiary = stateData;
      this.loading = false;
      this.cdr.markForCheck();
      this.loadReports(stateData.id);
      this.loadFamilyMembers(stateData.id);
      return;
    }

    this.api.get(`${this.rolePrefix}/beneficiary/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          this.beneficiary = data;
          this.loading = false;
          this.cdr.markForCheck();
          this.loadReports(data.id);
          this.loadFamilyMembers(data.id);
        },
        error: () => {
          toast.error('Beneficiary not found');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadFamilyMembers(beneficiaryId: number): void {
    this.api.get(`${this.rolePrefix}/beneficiary/${beneficiaryId}/family-members`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (members: any) => {
          if (this.beneficiary?.id === beneficiaryId) {
            this.beneficiary.children = members;
          }
          this.cdr.markForCheck();
        },
        error: () => {}
      });
  }

  private loadReports(beneficiaryId: number): void {
    this.reportsLoading = true;
    this.api.get(`${this.rolePrefix}/beneficiary/${beneficiaryId}/reports`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports: any) => {
          this.activityReports = reports || [];
          this.reportsLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.reportsLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  getScreeningBadge(report: any): string {
    return report?.reportData?.screening === 'Yes' ? 'Yes' : 'No';
  }

  getLocationPart(val: any): string {
    if (!val) return '—';
    return (val?.name || val).toString();
  }

  onSchoolingStatusChange(status: string | null): void {
    if (status === 'Currently studying') {
      this.familyForm.employmentStatus = 'Student';
    }
  }

  openFamilyModal(): void {
    this.familyForm = {
      name: '',
      relationship: '',
      dateOfBirth: '',
      gender: 'Female',
      schoolingStatus: '',
      employmentStatus: '',
      qualification: ''
    };
    
    this.dialogRef = this.dialog.create({
      zTitle: 'Add Family Member',
      zContent: this.familyModalTemplate,
      zWidth: '500px',
      zViewContainerRef: this.viewContainerRef,
      zHideFooter: true // We use our own footer in the template
    });
  }

  closeFamilyModal(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = null;
    }
  }

  saveFamilyMember(): void {
    if (!this.beneficiary) return;
    
    // Basic validation
    if (!this.familyForm.name || !this.familyForm.relationship || !this.familyForm.dateOfBirth || !this.familyForm.gender) {
      toast.error('Please fill all required fields');
      return;
    }

    const age = this.familyAge;

    // Schooling status: required if age >= 6 and age <= 14
    if (age >= 6 && age <= 14 && !this.familyForm.schoolingStatus) {
      toast.error('Schooling status is required');
      return;
    }

    // Qualification: required if age >= 6
    if (age >= 6 && !this.familyForm.qualification) {
      toast.error('Qualification is required');
      return;
    }

    // Working status: required if age >= 14
    if (age >= 14 && !this.familyForm.employmentStatus) {
      toast.error('Working status is required');
      return;
    }

    // Prepare payload
    const payload = { ...this.familyForm };

    // Backend validation requires schoolingStatus if age is >= 3 and <= 14.
    // If age is 3, 4, or 5 (which is < 6), default it to 'Not studying' as we don't ask it in UI.
    if (age >= 3 && age < 6 && !payload.schoolingStatus) {
      payload.schoolingStatus = 'Not studying';
    }

    this.savingFamily = true;
    this.cdr.markForCheck();

    this.api.post(`${this.rolePrefix}/beneficiary/${this.beneficiary.id}/family-member`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          toast.success('Family member added successfully');
          this.loadFamilyMembers(this.beneficiary!.id);
          this.closeFamilyModal();
          this.savingFamily = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          toast.error(err.error?.message || 'Failed to add family member');
          this.savingFamily = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Date Helpers ─────────────────────────────────────────────────────────

  private parseDateStr(dateStr: string): Date | null {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const p = dateStr.split('/');
      if (p.length === 3) {
        const day = Number(p[0]);
        const month = Number(p[1]) - 1;
        const year = Number(p[2]);
        const d = new Date(year, month, day);
        if (d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
          return d;
        }
      }
    } else {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  formatDateInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);

    let formatted = val;
    if (val.length > 4) {
      formatted = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);
    } else if (val.length > 2) {
      formatted = val.substring(0, 2) + '/' + val.substring(2, 4);
    }

    (this.familyForm as any)[controlName] = formatted;
    this.cdr.markForCheck();
  }

  openPicker(picker: HTMLInputElement) {
    try {
      picker.showPicker();
    } catch (e) {
      picker.focus();
    }
  }

  getNativeDateValue(controlName: string): string {
    const val = (this.familyForm as any)[controlName];
    const d = this.parseDateStr(val);
    if (d) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  }

  onNativeDateChange(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const parts = input.value.split('-');
      if (parts.length === 3) {
        const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        (this.familyForm as any)[controlName] = formatted;
        this.cdr.markForCheck();
      }
    }
  }

  goBack(): void {
    this.router.navigate([this.backRoute]);
  }
}

export { ZardBeneficiaryDetailComponent as BeneficiaryDetail };
