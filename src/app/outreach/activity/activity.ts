import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, startWith, switchMap } from 'rxjs';
import { toast } from 'ngx-sonner';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective, ZardSelectDirective } from '@/shared/components/input';

import { OutreachService } from '../outreach.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardIconComponent,
    ZardInputDirective,
    ZardSelectDirective,
  ],
  templateUrl: './activity.html',
  styleUrl: './activity.css',
})
export class Activity {
  private outreachService = inject(OutreachService);
  private fb = inject(FormBuilder);

  isSubmitting = false;

  reportForm = this.fb.group({
    activityId: ['', Validators.required],
    sessionId: ['', Validators.required],
    beneficiaryId: ['', Validators.required],
    attendanceStatus: ['Present', Validators.required],
    observation: ['', Validators.required],
  });

  activities$ = this.outreachService.getActiveActivities();
  beneficiaries$ = this.outreachService.getBeneficiaries();

  sessions$ = this.reportForm.get('activityId')!.valueChanges.pipe(
    startWith(this.reportForm.get('activityId')!.value),
    switchMap((activityId) =>
      activityId ? this.outreachService.getSessionsByActivity(Number(activityId)) : of([])
    )
  );

  submit() {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      toast.error('Please complete all report fields');
      return;
    }

    const raw = this.reportForm.getRawValue();
    this.isSubmitting = true;

    this.outreachService
      .submitReport({
        beneficiaryId: Number(raw.beneficiaryId),
        activityId: Number(raw.activityId),
        sessionId: Number(raw.sessionId),
        reportData: {
          attendanceStatus: raw.attendanceStatus,
          observation: raw.observation,
        },
      })
      .subscribe({
        next: () => {
          toast.success('Report submitted successfully');
          this.isSubmitting = false;
          this.reportForm.reset({ attendanceStatus: 'Present' });
        },
        error: (err) => {
          toast.error(err?.error?.message || 'Failed to submit report');
          this.isSubmitting = false;
        },
      });
  }
}
