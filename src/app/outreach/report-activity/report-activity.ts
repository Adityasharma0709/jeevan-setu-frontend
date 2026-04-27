import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
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
  selectedBeneficiary: Beneficiary | null = null;
  private rawSessions: OutreachSession[] = [];


  reportForm = this.fb.group({
    activityId: ['', Validators.required],
    sessionId: ['', Validators.required],
    sessionDate: [this.getTodayFormatted(), Validators.required],
    beneficiaryId: ['', Validators.required],
    childId: [''],
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
    }),
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
  ];

  get familyMemberOptions(): ZardComboboxOption[] {
    const options: ZardComboboxOption[] = [
      { value: '', label: 'Main Beneficiary' }
    ];
    
    if (this.selectedBeneficiary?.children) {
      this.selectedBeneficiary.children.forEach(child => {
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

  onSearchBeneficiary(event: any) {
    const value = event.target.value;
    this.beneficiarySearch$.next(value);
    
    // Clear selection when user starts typing a new search
    if (this.reportForm.get('beneficiaryId')?.value) {
      this.reportForm.patchValue({ beneficiaryId: '', childId: '' });
      this.selectedBeneficiary = null;
    }
  }

  onSelectBeneficiary(item: any) {
    const benId = item.isChild ? item.beneficiaryId : item.id;
    
    this.outreachService.getBeneficiary(benId).subscribe(beneficiary => {
      this.selectedBeneficiary = beneficiary;
      
      if (item.isChild) {
        this.reportForm.patchValue({ 
          beneficiaryId: benId.toString(),
          childId: item.id.toString() 
        });
        this.beneficiarySearch$.next(item.parentName);
      } else {
        this.reportForm.patchValue({ 
          beneficiaryId: benId.toString(),
          childId: ''
        });
        this.beneficiarySearch$.next(item.name);
      }
    });
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
    }

    const payload: any = {
      beneficiaryId: Number(raw.beneficiaryId),
      activityId: Number(raw.activityId),
      sessionId: raw.sessionId ? Number(raw.sessionId) : 0,
      sessionDate: this.parseDateForApi(raw.sessionDate || ''),
      reportData: {
        screening: raw.screening,
        screeningDetails: raw.screening === 'Yes' ? screeningDetails : null
      },
    };

    if (raw.childId) {
      payload.childId = Number(raw.childId);
    }

    const request$ = this.isEditing && this.reportId 
      ? this.outreachService.updateReport(this.reportId, payload as any)
      : this.outreachService.submitReport(payload);

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
  }

  private loadReport(id: number) {
    this.outreachService.getReportById(id).subscribe({
      next: (report) => {
        const benId = report.beneficiaryId;
        if (benId) {
          this.outreachService.getBeneficiary(benId).subscribe(ben => {
            this.selectedBeneficiary = ben;
            this.beneficiarySearch$.next(ben.name);
          });
        }

        const reportData = report.reportData || {};
        const screeningDetails = reportData.screeningDetails || {};
        const screening = reportData.screening || 'No';

        // Set to string format for combobox compatibility
        this.reportForm.patchValue({
          activityId: report.activityId?.toString() || '',
          sessionId: report.sessionId?.toString() || '',
          beneficiaryId: report.beneficiaryId?.toString() || '',
          childId: report.childId?.toString() || '',
          sessionDate: this.formatDateForInput(report.sessionDate),
          screening: report.reportData?.screening || 'No',
          selectedTests: [],
          testValues: {}
        });if (screening === 'Yes') {
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
        }
      },
      error: () => toast.error('Failed to load report for editing')
    });
  }
}
