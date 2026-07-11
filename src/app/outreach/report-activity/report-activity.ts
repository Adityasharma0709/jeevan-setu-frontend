import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap, catchError, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { Router, ActivatedRoute } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormFieldComponent, ZardFormLabelComponent, ZardFormControlComponent } from '@/shared/components/form';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { OutreachService, OutreachSession, Beneficiary } from '../outreach.service';

@Component({
  selector: 'app-report-activity',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormFieldComponent,
    ZardFormLabelComponent,
    ZardFormControlComponent,
    ZardInputDirective,
    ZardInputDirective,
    ZardIconComponent,
    ZardComboboxComponent
  ],
  templateUrl: './report-activity.html',
})
export class ReportActivity {
  private fb = inject(FormBuilder);
  private outreachService = inject(OutreachService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isSubmitting = false;
  isEditing = false;
  reportId: number | null = null;
  selectedBeneficiary = signal<Beneficiary | null>(null);
  private rawSessions: OutreachSession[] = [];


  reportForm = this.fb.group({
    activityId: ['', Validators.required],
    sessionId: ['', Validators.required],
    sessionDate: [this.getTodayFormatted(), Validators.required],
    beneficiaryId: ['', Validators.required],
    childId: ['MAIN'],
    screening: ['No', Validators.required],
    selectedTests: this.fb.array([]),
    testValues: this.fb.group({
      height: [''],
      weight: [''],
      hb: [''],
      bpSystolic: [''],
      bpDiastolic: [''],
      sugar: [''],
      cervicalCancer: ['Negative'],
      breastCancer: ['Negative'],
      pads: [''],
    }),
    pregnancyStatus: [''],
    pregnancyOutcome: [''],
    lmpDate: [''],
    edd: [''],
    pregnancyDate: [''],
    deliveryDate: [''],
    babyDetails: this.fb.group({
      name: [''],
      gender: [''],
      relation: ['Son/Daughter'],
    }),
    samMamStatus: [''],
    age: [{ value: '', disabled: true }],
    groupText: [{ value: '', disabled: true }],
  });

  beneficiarySearch$ = new BehaviorSubject<string>('');

  activities$ = this.outreachService.getActiveActivities().pipe(
    map(activities => activities.map(a => ({ value: a.id.toString(), label: a.name })))
  );
  
  beneficiaries$ = this.beneficiarySearch$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(search => {
      if (!search) return of([]);
      return this.outreachService.getBeneficiaries(search);
    }),
    map(beneficiaries => {
      const flattened: any[] = [];
      beneficiaries.forEach(ben => {
        // Add the main beneficiary
        flattened.push({ ...ben, isChild: false });
        
        // Add children as selectable entities
        if (ben.children && ben.children.length > 0) {
          ben.children.forEach(child => {
            flattened.push({
              ...child,
              isChild: true,
              parentName: ben.name,
              beneficiaryId: ben.id // Keep parent ID for report linking
            });
          });
        }
      });
      return flattened;
    }),
    startWith([])
  );

  sessions$ = this.reportForm.get('activityId')!.valueChanges.pipe(
    startWith(this.reportForm.get('activityId')!.value),
    switchMap((activityId) =>
      activityId ? this.outreachService.getSessionsByActivity(Number(activityId)) : of([])
    ),
    tap((sessions: OutreachSession[]) => this.rawSessions = sessions),
    map((sessions: OutreachSession[]) => sessions.map(s => ({ 
      value: s.id.toString(), 
      label: (s.name || '').split('(')[0].trim() 
    })))
  );

  screeningOptions: ZardComboboxOption[] = [
    { value: 'No', label: 'No' },
    { value: 'Yes', label: 'Yes' }
  ];

  pregnancyStatusOptions: ZardComboboxOption[] = [
    { value: 'No', label: 'No' },
    { value: 'Currently Pregnant', label: 'Currently Pregnant' },
  ];

  pregnancyOutcomeOptions: ZardComboboxOption[] = [
    { value: '', label: 'Select Outcome' },
    { value: 'Still Birth', label: 'Still Birth' },
    { value: 'Miscarriage/Aborted', label: 'Miscarriage/Aborted' },
    { value: 'Baby Delivered', label: 'Baby Delivered' },
  ];

  genderOptions: ZardComboboxOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ];


  samMamOptions: ZardComboboxOption[] = [
    { value: 'SAM', label: 'SAM (Severe Acute Malnutrition)' },
    { value: 'MAM', label: 'MAM (Moderate Acute Malnutrition)' },
    { value: 'NONE', label: 'None' }
  ];

  cancerResultOptions: ZardComboboxOption[] = [
    { value: 'Negative', label: 'Negative' },
    { value: 'Positive', label: 'Positive' }
  ];

  availableTests = [
    { id: 'height', label: 'Height' },
    { id: 'weight', label: 'Weight' },
    { id: 'hb', label: 'Hb' },
    { id: 'bp', label: 'BP' },
    { id: 'sugar', label: 'Sugar' },
    { id: 'cervicalCancer', label: 'Cervical Cancer' },
    { id: 'breastCancer', label: 'Breast Cancer' },
    { id: 'pads', label: 'Pads' },
  ];

  wasPreviouslyPregnant = false;

  checkPreviousPregnancyStatus(beneficiaryId: number, currentReportId: number | null, savedOutcome?: string) {
    this.outreachService.getReportsByBeneficiary(beneficiaryId).subscribe(reports => {
      const otherReports = reports.filter(r => currentReportId === null || r.id !== currentReportId);
      otherReports.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt).getTime();
        const dateB = new Date(b.date || b.createdAt).getTime();
        return dateB - dateA;
      });

      const lastPregnancyReport = otherReports.find(r => r.reportData && r.reportData.pregnancyStatus);

      if (lastPregnancyReport) {
        const status = lastPregnancyReport.reportData.pregnancyStatus;
        this.wasPreviouslyPregnant = status === 'Currently Pregnant' || status === 'Yes';
      } else {
        this.wasPreviouslyPregnant = false;
      }

      if (savedOutcome && ['Still Birth', 'Miscarriage/Aborted', 'Baby Delivered'].includes(savedOutcome)) {
        this.wasPreviouslyPregnant = true;
      }
    });
  }

  calculateEDD(lmpDateStr: string): string {
    if (!lmpDateStr) return '';
    const parts = lmpDateStr.split(/[-/]/);
    if (parts.length !== 3) return '';
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const lmpDate = new Date(year, month, day);
    if (isNaN(lmpDate.getTime())) return '';
    
    const eddDate = new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
    const eddDay = String(eddDate.getDate()).padStart(2, '0');
    const eddMonth = String(eddDate.getMonth() + 1).padStart(2, '0');
    const eddYear = eddDate.getFullYear();
    return `${eddDay}/${eddMonth}/${eddYear}`;
  }

  /** True when selected entity is female AND aged 14 or more */
  get showPregnancy(): boolean {
    const child = this.getSelectedChild();
    if (child) {
      return child.gender?.toLowerCase() === 'female' && this.calcAge(child.dateOfBirth) >= 14;
    }
    const ben = this.selectedBeneficiary();
    if (ben) {
      return ben.gender?.toLowerCase() === 'female' &&
        this.calcAge(ben.dateOfBirth) >= 14;
    }
    return false;
  }

  /** True when selected entity (child or beneficiary) is aged 5 or under */
  get showSamMam(): boolean {
    const child = this.getSelectedChild();
    if (child) {
      return this.calcAge(child.dateOfBirth) <= 5;
    }
    const childId = this.reportForm.get('childId')?.value;
    const ben = this.selectedBeneficiary();
    if (ben && (!childId || childId === 'MAIN')) {
      return this.calcAge(ben.dateOfBirth) <= 5;
    }
    return false;
  }

  get showOutcomeDropdown(): boolean {
    return this.showPregnancy && this.wasPreviouslyPregnant;
  }

  /** True when pregnancy status is Currently Pregnant */
  get showLmpDate(): boolean {
    return this.reportForm.get('pregnancyStatus')?.value === 'Currently Pregnant';
  }

  get showPregnancyDate(): boolean {
    const outcome = this.reportForm.get('pregnancyOutcome')?.value;
    return this.showOutcomeDropdown && (outcome === 'Still Birth' || outcome === 'Miscarriage/Aborted');
  }

  get showDeliveryDate(): boolean {
    const outcome = this.reportForm.get('pregnancyOutcome')?.value;
    return this.showOutcomeDropdown && outcome === 'Baby Delivered';
  }

  private calcAge(dob: any): number {
    if (!dob) return 0;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  private getSelectedChild(): any | null {
    const childId = this.reportForm.get('childId')?.value;
    const ben = this.selectedBeneficiary();
    if (!childId || childId === 'MAIN' || !ben?.children) return null;
    return ben.children.find((c: any) => c.id.toString() === childId.toString()) || null;
  }

  get familyMemberOptions(): ZardComboboxOption[] {
    const options: ZardComboboxOption[] = [
      { value: 'MAIN', label: 'Main Beneficiary' }
    ];
    
    const ben = this.selectedBeneficiary();
    if (ben?.children) {
      ben.children.forEach(child => {
        options.push({ value: child.id.toString(), label: child.name });
      });
    }
    
    return options;
  }

  private getTodayFormatted(): string {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  }

  private parseDateForApi(d: string): string {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) {
      // If it's already yyyy-mm-dd (from some other source), keep it
      if (parts[0].length === 4) return d;
      // Convert dd-mm-yyyy to yyyy-mm-dd
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  }

  private formatDateForInput(d: any): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  isTestSelected(testId: string): boolean {
    return (this.reportForm.get('selectedTests') as any).value.includes(testId);
  }

  toggleTest(testId: string) {
    const testsArray = this.reportForm.get('selectedTests') as any;
    const index = testsArray.value.indexOf(testId);
    if (index >= 0) {
      testsArray.removeAt(index);
    } else {
      testsArray.push(this.fb.control(testId));
    }
  }

  onPickerChange(event: any) {
    const pickerDate = event.target.value; // yyyy-mm-dd
    if (pickerDate) {
      const parts = pickerDate.split('-');
      const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`; // dd-mm-yyyy
      this.reportForm.patchValue({ sessionDate: formatted });
    }
  }

  onLmpPickerChange(event: any) {
    const pickerDate = event.target.value; // yyyy-mm-dd
    if (pickerDate) {
      const parts = pickerDate.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`; // dd/mm/yyyy
      this.reportForm.patchValue({ lmpDate: formatted });
    }
  }

  onEddPickerChange(event: any) {
    const pickerDate = event.target.value; // yyyy-mm-dd
    if (pickerDate) {
      const parts = pickerDate.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`; // dd/mm/yyyy
      this.reportForm.patchValue({ edd: formatted });
    }
  }

  onPregnancyDatePickerChange(event: any) {
    const pickerDate = event.target.value; 
    if (pickerDate) {
      const parts = pickerDate.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`; 
      this.reportForm.patchValue({ pregnancyDate: formatted });
    }
  }

  onDeliveryDatePickerChange(event: any) {
    const pickerDate = event.target.value; 
    if (pickerDate) {
      const parts = pickerDate.split('-');
      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`; 
      this.reportForm.patchValue({ deliveryDate: formatted });
    }
  }

  onSearchBeneficiary(event: any) {
    const value = event.target.value;
    this.beneficiarySearch$.next(value);
    
    // Clear selection when user starts typing a new search
    if (this.reportForm.get('beneficiaryId')?.value) {
      this.reportForm.patchValue({ beneficiaryId: '', childId: 'MAIN' });
      this.selectedBeneficiary.set(null);
    }
  }

  onSelectBeneficiary(item: any) {
    const benId = item.isChild ? item.beneficiaryId : item.id;
    
    this.outreachService.getBeneficiary(benId).subscribe(beneficiary => {
      this.selectedBeneficiary.set(beneficiary);

      if (item.isChild) {
        this.reportForm.patchValue({ 
          beneficiaryId: benId.toString(),
          childId: item.id.toString(),
          age: this.calcAge(item.dateOfBirth).toString()
        });
        this.beneficiarySearch$.next(item.parentName);
      } else {
        this.reportForm.patchValue({ 
          beneficiaryId: benId.toString(),
          childId: 'MAIN',
          age: this.calcAge(beneficiary.dateOfBirth).toString()
        });
        this.beneficiarySearch$.next(item.name);
      }

      this.checkPreviousPregnancyStatus(benId, this.reportId);
      this.updateCalculatedGroup();
    });
  }

  updateCalculatedGroup() {
    const ben = this.selectedBeneficiary();
    if (!ben) {
      this.reportForm.patchValue({ groupText: '' }, { emitEvent: false });
      return;
    }

    const childId = this.reportForm.get('childId')?.value;
    let groupsText = 'N/A';

    if (childId && childId !== 'MAIN') {
      const child = ben.children?.find((c: any) => c.id.toString() === childId.toString());
      if (child && child.childGroups && child.childGroups.length > 0) {
        groupsText = child.childGroups.map((g: any) => g.group?.name || g.name).join(', ');
      }
    } else {
      if (ben.groups && ben.groups.length > 0) {
        groupsText = ben.groups.map((g: any) => g.group?.name || g.name).join(', ');
      }
    }

    this.reportForm.patchValue({ groupText: groupsText }, { emitEvent: false });
  }

  submit() {
    if (this.reportForm.invalid) {
      toast.error('Please complete all required fields');
      return;
    }

    const raw = this.reportForm.getRawValue();
    this.isSubmitting = true;

    // Filter values based on selected tests
    const screeningDetails: any = {};
    if (raw.screening === 'Yes') {
      const selected = raw.selectedTests || [];
      if (selected.includes('height')) screeningDetails.height = Number(raw.testValues.height);
      if (selected.includes('weight')) screeningDetails.weight = Number(raw.testValues.weight);
      if (selected.includes('hb')) screeningDetails.hb = Number(raw.testValues.hb);
      if (selected.includes('sugar')) screeningDetails.sugar = Number(raw.testValues.sugar);
      if (selected.includes('bp')) {
        screeningDetails.bp = `${raw.testValues.bpSystolic}/${raw.testValues.bpDiastolic}`;
      }
      if (selected.includes('cervicalCancer')) screeningDetails.cervicalCancer = raw.testValues.cervicalCancer;
      if (selected.includes('breastCancer')) screeningDetails.breastCancer = raw.testValues.breastCancer;
      if (selected.includes('pads')) screeningDetails.pads = Number(raw.testValues.pads);
    }

    const reportData: any = {
      screening: raw.screening,
      screeningDetails: raw.screening === 'Yes' ? screeningDetails : null,
      group: raw.groupText || 'None',
    };

    // Pregnancy status and outcome (optional, female 14+)
    if (this.showPregnancy) {
      const rawStatus = raw.pregnancyStatus;
      const rawOutcome = raw.pregnancyOutcome;

      if (this.showOutcomeDropdown && rawOutcome) {
        reportData.pregnancyStatus = rawOutcome;
        reportData.pregnancyOutcome = rawOutcome;
      } else if (rawStatus) {
        reportData.pregnancyStatus = rawStatus;
      }

      if (reportData.pregnancyStatus === 'Currently Pregnant') {
        if (raw.lmpDate) reportData.lmpDate = raw.lmpDate;
        if (raw.edd) reportData.edd = raw.edd;
      } else if ((reportData.pregnancyStatus === 'Still Birth' || reportData.pregnancyStatus === 'Miscarriage/Aborted') && raw.pregnancyDate) {
        reportData.date = raw.pregnancyDate;
      } else if (reportData.pregnancyStatus === 'Baby Delivered' && raw.deliveryDate) {
        reportData.dod = raw.deliveryDate;
        if (raw.babyDetails) {
          reportData.babyDetails = raw.babyDetails;
        }
      }
    }

    // SAM/MAM status (child ≤ 5 years)
    if (this.showSamMam && raw.samMamStatus) {
      reportData.samMamStatus = raw.samMamStatus;
    }

    const payload: any = {
      beneficiaryId: Number(raw.beneficiaryId),
      activityId: Number(raw.activityId),
      sessionId: raw.sessionId ? Number(raw.sessionId) : 0,
      sessionDate: this.parseDateForApi(raw.sessionDate || ''),
      reportData,
    };

    if (raw.childId && raw.childId !== 'MAIN') {
      payload.childId = Number(raw.childId);
    }

    const saveReport$ = this.isEditing && this.reportId 
      ? this.outreachService.updateReport(this.reportId, payload as any)
      : this.outreachService.submitReport(payload);

    const request$ = (!this.isEditing && this.showDeliveryDate && raw.babyDetails?.name)
      ? this.outreachService.addFamilyMember(Number(raw.beneficiaryId), {
          name: raw.babyDetails.name || '',
          gender: raw.babyDetails.gender || '',
          relationship: raw.babyDetails.relation || '',
          dateOfBirth: this.parseDateForApi((raw.deliveryDate || '').split('/').join('-')),
        }).pipe(
          switchMap(() => saveReport$),
          catchError((err) => {
            // Ignore error of family member add, and just save report
            // or pass it along to let the UI show error
            return throwError(() => err);
          })
        )
      : saveReport$;

    request$.subscribe({
        next: () => {
          toast.success('Report submitted successfully');
          this.isSubmitting = false;
          this.router.navigate(['/outreach/activity']);
        },
        error: (err: any) => {
          toast.error(err?.error?.message || 'Failed to submit report');
          this.isSubmitting = false;
        },
      });
  }

  cancel() {
    this.router.navigate(['/outreach/activity']);
  }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['reportId']) {
        this.reportId = +params['reportId'];
        this.isEditing = true;
        this.loadReport(this.reportId);
      }
    });

    this.reportForm.get('sessionId')?.valueChanges.subscribe(sessionId => {
      // Logic removed to allow Reporting Date to remain independent of Session Date
    });

    this.reportForm.get('childId')?.valueChanges.subscribe(childId => {
      const ben = this.selectedBeneficiary();
      if (!ben) return;
      let targetAge = 0;
      if (childId && childId !== 'MAIN') {
        const child = ben.children?.find((c: any) => c.id.toString() === childId.toString());
        if (child) {
          targetAge = this.calcAge(child.dateOfBirth);
          this.reportForm.patchValue({ age: targetAge.toString() }, { emitEvent: false });
          this.updateCalculatedGroup();
        }
      } else {
        targetAge = this.calcAge(ben.dateOfBirth);
        this.reportForm.patchValue({ age: targetAge.toString() }, { emitEvent: false });
        this.updateCalculatedGroup();
      }
    });

    this.reportForm.get('samMamStatus')?.valueChanges.subscribe(() => {
      this.updateCalculatedGroup();
    });

    this.reportForm.get('pregnancyStatus')?.valueChanges.subscribe(() => {
      this.updateCalculatedGroup();
    });

    this.reportForm.get('pregnancyOutcome')?.valueChanges.subscribe(() => {
      this.updateCalculatedGroup();
    });

    this.reportForm.get('lmpDate')?.valueChanges.subscribe(val => {
      if (val) {
        const edd = this.calculateEDD(val);
        if (edd) {
          this.reportForm.patchValue({ edd }, { emitEvent: false });
        }
      }
    });
  }

  private loadReport(id: number) {
    this.outreachService.getReportById(id).subscribe({
      next: (report) => {
        const benId = report.beneficiaryId;
        if (report.beneficiary) {
          this.selectedBeneficiary.set(report.beneficiary);
          this.beneficiarySearch$.next(report.beneficiary.name);

          let targetAge = 0;
          if (report.child) {
            targetAge = this.calcAge(report.child.dateOfBirth);
          } else {
            targetAge = this.calcAge(report.beneficiary.dateOfBirth);
          }
          this.reportForm.patchValue({ age: targetAge.toString() }, { emitEvent: false });
          this.updateCalculatedGroup();
        }

        if (benId) {
          this.outreachService.getBeneficiary(benId).subscribe(ben => {
            this.selectedBeneficiary.set(ben);
            this.beneficiarySearch$.next(ben.name);
            
            const childId = this.reportForm.get('childId')?.value;
            let targetAge = 0;
            if (childId && childId !== 'MAIN') {
              const child = ben.children?.find((c: any) => c.id.toString() === childId.toString());
              if (child) targetAge = this.calcAge(child.dateOfBirth);
            } else {
              targetAge = this.calcAge(ben.dateOfBirth);
            }
            this.reportForm.patchValue({ age: targetAge.toString() }, { emitEvent: false });

            this.updateCalculatedGroup();
          });
        }

        const reportData = report.reportData || {};
        const screeningDetails = reportData.screeningDetails || {};
        const screening = reportData.screening || 'No';

        const savedStatus = reportData.pregnancyStatus || '';
        let formStatus = '';
        let formOutcome = '';

        if (savedStatus === 'Currently Pregnant' || savedStatus === 'No' || savedStatus === 'Yes') {
          formStatus = savedStatus;
          formOutcome = '';
        } else if (['Still Birth', 'Miscarriage/Aborted', 'Baby Delivered'].includes(savedStatus)) {
          formStatus = 'No';
          formOutcome = savedStatus;
        }

        // Set to string format for combobox compatibility
        this.reportForm.patchValue({
          activityId: report.activityId?.toString() || '',
          sessionId: report.sessionId?.toString() || '',
          beneficiaryId: report.beneficiaryId?.toString() || '',
          childId: report.childId?.toString() || 'MAIN',
          sessionDate: this.formatDateForInput(report.date || report.sessionDate),
          screening: report.reportData?.screening || 'No',
          selectedTests: [],
          testValues: {},
          pregnancyStatus: formStatus,
          pregnancyOutcome: formOutcome,
          lmpDate: reportData.lmpDate || '',
          edd: reportData.edd || '',
          pregnancyDate: reportData.date || '',
          deliveryDate: reportData.dod || '',
          babyDetails: reportData.babyDetails || { name: '', gender: '', relation: 'Son/Daughter' },
          samMamStatus: reportData.samMamStatus || '',
        });

        if (benId) {
          this.checkPreviousPregnancyStatus(benId, id, formOutcome);
        }

        if (screening === 'Yes') {
          if (screeningDetails.height) { this.toggleTest('height'); this.reportForm.get('testValues.height')!.setValue(screeningDetails.height); }
          if (screeningDetails.weight) { this.toggleTest('weight'); this.reportForm.get('testValues.weight')!.setValue(screeningDetails.weight); }
          if (screeningDetails.hb) { this.toggleTest('hb'); this.reportForm.get('testValues.hb')!.setValue(screeningDetails.hb); }
          if (screeningDetails.sugar) { this.toggleTest('sugar'); this.reportForm.get('testValues.sugar')!.setValue(screeningDetails.sugar); }
          if (screeningDetails.bp) { 
            this.toggleTest('bp'); 
            const parts = screeningDetails.bp.split('/');
            this.reportForm.get('testValues.bpSystolic')!.setValue(parts[0] || '');
            this.reportForm.get('testValues.bpDiastolic')!.setValue(parts[1] || '');
          }
          if (screeningDetails.cervicalCancer) { this.toggleTest('cervicalCancer'); this.reportForm.get('testValues.cervicalCancer')!.setValue(screeningDetails.cervicalCancer); }
          if (screeningDetails.breastCancer) { this.toggleTest('breastCancer'); this.reportForm.get('testValues.breastCancer')!.setValue(screeningDetails.breastCancer); }
          if (screeningDetails.pads) { this.toggleTest('pads'); this.reportForm.get('testValues.pads')!.setValue(screeningDetails.pads); }
        }
      },
      error: () => toast.error('Failed to load report for editing')
    });
  }
}
