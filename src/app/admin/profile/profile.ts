import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ApiService } from '../../core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { catchError, finalize, map, of, take, timeout } from 'rxjs';

@Component({
    selector: 'app-admin-profile',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ZardButtonComponent,
        ZardInputDirective,
        ZardFormControlComponent,
        ZardFormFieldComponent,
    ],
    templateUrl: './profile.html',
    styleUrl: './profile.css',
})
export class Profile implements OnInit {
    profileForm!: FormGroup;
    isSubmitting = false;
    isLoading = false;

    constructor(
        private fb: FormBuilder,
        private api: ApiService,
        private cdr: ChangeDetectorRef,
    ) {
        this.profileForm = this.fb.group({
            name: ['', Validators.required],
            email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
            mobile: ['', [Validators.pattern('^[0-9]{10}$')]]
        });
    }

    ngOnInit() {
        this.loadProfile();
    }

    loadProfile() {
        this.isLoading = true;

        this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
            take(1),
            timeout({ each: 10000 }),
            map((raw: any) => {
                const candidate = raw?.data ?? raw?.user ?? raw?.profile ?? raw;
                if (!candidate || typeof candidate !== 'object') return null;
                return {
                    name: (candidate as any).name ?? '',
                    email: (candidate as any).email ?? '',
                    mobile: (candidate as any).mobile ?? (candidate as any).phone ?? '',
                };
            }),
            map((profile) => {
                if (!profile) throw new Error('Invalid profile response');
                return profile;
            }),
            // If patchValue throws (bad shape), it becomes an error and finalize still runs
            map((profile) => {
                this.profileForm.patchValue(profile);
                return profile;
            }),
            catchError((err) => {
                const msg = err?.error?.message || err?.message || 'Failed to load profile';
                setTimeout(() => toast.error(msg), 0);
                return of(null);
            }),
            finalize(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            }),
        ).subscribe();
    }

    submit() {
        if (this.isSubmitting) return;
        if (this.profileForm.invalid) {
            setTimeout(() => toast.error('Please fill all fields correctly'), 0);
            return;
        }

        this.isSubmitting = true;
        this.api.put('users/profile', this.profileForm.getRawValue()).pipe(
            take(1),
            timeout({ each: 15000 }),
            finalize(() => {
                this.isSubmitting = false;
                this.cdr.markForCheck();
            }),
        ).subscribe({
            next: () => {
                setTimeout(() => toast.success('Profile updated successfully'), 0);
            },
            error: (err: any) => {
                setTimeout(() => toast.error(err?.error?.message || 'Update failed'), 0);
            },
        });
    }
}
