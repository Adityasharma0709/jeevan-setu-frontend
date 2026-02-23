import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective } from '@/shared/components/input';

import { OutreachService } from '../outreach.service';

@Component({
  selector: 'app-outreach-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardIconComponent,
    ZardInputDirective,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private outreachService = inject(OutreachService);
  private fb = inject(FormBuilder);

  isLoading = true;
  isSubmitting = false;

  form = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    mobile: ['', [Validators.pattern('^[0-9]{10}$')]],
    reason: ['', Validators.required],
  });

  constructor() {
    this.loadProfile();
  }

  private loadProfile() {
    this.outreachService.getProfile().subscribe({
      next: (profile: any) => {
        this.form.patchValue({
          name: profile?.name || '',
          email: profile?.email || '',
          mobile: profile?.mobileNumber || '',
        });
        this.isLoading = false;
      },
      error: () => {
        toast.error('Failed to load profile');
        this.isLoading = false;
      },
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Please complete required fields');
      return;
    }

    const raw = this.form.getRawValue();
    this.isSubmitting = true;

    this.outreachService
      .raiseRequest('MODIFY_PROFILE', {
        name: raw.name,
        mobile: raw.mobile,
        reason: raw.reason,
      })
      .subscribe({
        next: () => {
          toast.success('Profile change request submitted');
          this.form.patchValue({ reason: '' });
          this.isSubmitting = false;
        },
        error: (err) => {
          toast.error(err?.error?.message || 'Failed to submit request');
          this.isSubmitting = false;
        },
      });
  }
}
