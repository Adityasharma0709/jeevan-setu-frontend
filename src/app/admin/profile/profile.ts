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
            mobile: ['', [Validators.pattern('^[0-9]{10}$')]],
            password: [''],
        });
    }

    ngOnInit() {
        this.loadProfile();
    }

    private normalizeMobile(value: unknown): string {
        if (value === null || value === undefined) return '';
        const text = String(value).trim();
        if (!text) return '';
        const digits = text.replace(/\D/g, '');
        if (!digits) return '';
        // Common cases: "+91XXXXXXXXXX" or "91XXXXXXXXXX"
        if (digits.length > 10) return digits.slice(-10);
        return digits;
    }

    private findFirstByKeysDeep(source: unknown, keys: string[], maxDepth = 6): unknown {
        if (!source || typeof source !== 'object') return undefined;

        const visited = new WeakSet<object>();
        const queue: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];

        while (queue.length) {
            const { value, depth } = queue.shift()!;
            if (!value || typeof value !== 'object') continue;

            const obj = value as object;
            if (visited.has(obj)) continue;
            visited.add(obj);

            // Check direct keys first (BFS keeps "closest" matches consistent)
            for (const key of keys) {
                const direct = (value as any)?.[key];
                if (direct !== null && direct !== undefined && String(direct).trim()) {
                    return direct;
                }
            }

            if (depth >= maxDepth) continue;

            if (Array.isArray(value)) {
                for (const item of value) queue.push({ value: item, depth: depth + 1 });
                continue;
            }

            for (const child of Object.values(value as Record<string, unknown>)) {
                if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
            }
        }

        return undefined;
    }

    loadProfile() {
        this.isLoading = true;

        this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
            take(1),
            timeout({ each: 10000 }),
            map((raw: any) => {
                const candidate = raw?.data ?? raw?.user ?? raw?.profile ?? raw;
                if (!candidate || typeof candidate !== 'object') return null;

                const mobileKeys = [
                    'mobile',
                    'mobileNumber',
                    'mobile_number',
                    'mobileNo',
                    'phone',
                    'phoneNumber',
                    'phone_number',
                    'contactNumber',
                    'contact_number',
                ];

                const mobileRaw = this.findFirstByKeysDeep(raw, mobileKeys);
                const mobile = this.normalizeMobile(mobileRaw);

                const nameRaw =
                    this.findFirstByKeysDeep(raw, ['name', 'fullName', 'full_name']) ??
                    (candidate as any).name ??
                    '';
                const emailRaw =
                    this.findFirstByKeysDeep(raw, ['email', 'emailId', 'email_id']) ??
                    (candidate as any).email ??
                    '';

                return {
                    name: String(nameRaw ?? '').trim(),
                    email: String(emailRaw ?? '').trim(),
                    mobile,
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
        const payload: any = this.profileForm.getRawValue();
        if (!payload.password) delete payload.password;
        delete payload.email; // Do not send disabled email if it causes issues, but getRawValue includes it.
        
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
