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
    selector: 'app-super-admin-profile',
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
export class ProfileComponent implements OnInit {
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
            password: [''],
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

                const nameRaw = candidate.name ?? '';
                const emailRaw = candidate.email ?? '';

                return {
                    name: String(nameRaw ?? '').trim(),
                    email: String(emailRaw ?? '').trim(),
                };
            }),
            map((profile) => {
                if (!profile) throw new Error('Invalid profile response');
                return profile;
            }),
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

        const payload: any = {
            name: this.profileForm.value.name,
        };

        if (this.profileForm.value.password) {
            payload.password = this.profileForm.value.password;
        }

        this.isSubmitting = true;
        this.api.put('users/profile', payload).pipe(
            take(1),
            timeout({ each: 15000 }),
            finalize(() => {
                this.isSubmitting = false;
                this.cdr.markForCheck();
            }),
        ).subscribe({
            next: () => {
                setTimeout(() => toast.success('Profile updated successfully'), 0);
                this.profileForm.get('password')?.setValue('');
            },
            error: (err: any) => {
                setTimeout(() => toast.error(err?.error?.message || 'Update failed'), 0);
            },
        });
    }
}
