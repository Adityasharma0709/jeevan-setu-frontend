import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { catchError, defer, map, of, shareReplay, startWith, tap } from 'rxjs';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective } from '@/shared/components/input';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

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
    LottieComponent,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private outreachService = inject(OutreachService);
  private fb = inject(FormBuilder);
  private readonly cacheKey = 'outreach.profile.cache';

  isSubmitting = false;
  options: AnimationOptions = { path: '/loading.json' };

  form = this.fb.group({
    name: ['', Validators.required],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    mobile: ['', [Validators.pattern('^[0-9]{10}$')]],
  });

  readonly state$ = defer(() => {
    const cached = this.readCachedProfile();
    if (cached) {
      this.patchForm(cached);
    }

    return this.outreachService.getProfile().pipe(
      tap((profile: any) => {
        this.storeCachedProfile(profile);
        this.patchForm(profile);
      }),
      map((profile: any) => ({ status: 'loaded' as const, profile })),
      catchError(() => {
        toast.error('Failed to load profile');
        return of({ status: 'error' as const, profile: cached });
      }),
      startWith({ status: 'loading' as const, profile: cached }),
      shareReplay(1)
    );
  });

  constructor() {}

  ngOnInit() {}

  private readCachedProfile() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) {
        return null;
      }
      return JSON.parse(cached) as { name?: string; email?: string; mobileNumber?: string };
    } catch {
      return null;
    }
  }

  private storeCachedProfile(profile: any) {
    try {
      const payload = {
        name: profile?.name || '',
        email: profile?.email || '',
        mobileNumber: profile?.mobileNumber || '',
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }

  private patchForm(profile: { name?: string; email?: string; mobileNumber?: string } | null) {
    if (!profile) {
      return;
    }
    this.form.patchValue(
      {
        name: profile?.name || '',
        email: profile?.email || '',
        mobile: profile?.mobileNumber || '',
      },
      { emitEvent: false }
    );
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
        changes: {
          name: raw.name,
          mobile: raw.mobile,
        },
      })
      .subscribe({
        next: () => {
          toast.success('Profile change request submitted');
          this.isSubmitting = false;
        },
        error: (err) => {
          toast.error(err?.error?.message || 'Failed to submit request');
          this.isSubmitting = false;
        },
      });
  }
}
