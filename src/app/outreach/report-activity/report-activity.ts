import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { Router } from '@angular/router';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormFieldComponent, ZardFormLabelComponent, ZardFormControlComponent } from '@/shared/components/form';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { OutreachService } from '../outreach.service';

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

  isSubmitting = false;

  reportForm = this.fb.group({
    activityId: ['', Validators.required],
    sessionId: ['', Validators.required],
    sessionDate: [new Date().toISOString().split('T')[0], Validators.required],
    beneficiaryId: ['', Validators.required],
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
    switchMap(search => this.outreachService.getBeneficiaries(search)),
    startWith([])
  );

  sessions$ = this.reportForm.get('activityId')!.valueChanges.pipe(
    startWith(this.reportForm.get('activityId')!.value),
    switchMap((activityId) =>
      activityId ? this.outreachService.getSessionsByActivity(Number(activityId)) : of([])
    ),
    map(sessions => sessions.map(s => ({ 
      value: s.id.toString(), 
      label: s.name.split('(')[0].trim() 
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

  onSearchBeneficiary(event: any) {
    this.beneficiarySearch$.next(event.target.value);
  }

  onSelectBeneficiary(beneficiary: any) {
    this.reportForm.patchValue({ beneficiaryId: beneficiary.id });
    this.beneficiarySearch$.next(`${beneficiary.name} (${beneficiary.uid})`);
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

    this.outreachService
      .submitReport({
        beneficiaryId: Number(raw.beneficiaryId),
        activityId: Number(raw.activityId),
        sessionId: raw.sessionId ? Number(raw.sessionId) : 0,
        sessionDate: raw.sessionDate ?? '',
        reportData: {
          screening: raw.screening,
          screeningDetails: raw.screening === 'Yes' ? screeningDetails : null
        },
      })
      .subscribe({
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
}
