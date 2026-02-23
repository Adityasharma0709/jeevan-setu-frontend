import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ApiService } from '../../core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';

@Component({
    selector: 'app-admin-profile',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ZardButtonComponent,
        ZardInputDirective,
        ZardFormControlComponent,
        ZardFormFieldComponent
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
        private api: ApiService
    ) {
        this.profileForm = this.fb.group({
            name: ['', Validators.required],
            email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
            mobile: ['', [Validators.pattern('^[0-9]{10}$')]]
        });
    }

    ngOnInit() {
        console.log('Profile component initialized');
        this.loadProfile();

        // Fallback timeout to prevent infinite loading
        setTimeout(() => {
            if (this.isLoading) {
                console.error('Profile loading timeout - forcing stop');
                this.isLoading = false;
                setTimeout(() => toast.error('Failed to load profile - request timeout'), 0);
            }
        }, 10000); // 10 second timeout
    }

    loadProfile() {
        console.log('Loading profile...');
        this.isLoading = true;

        this.api.get('auth/me').subscribe({
            next: (profile: any) => {
                console.log('Profile loaded:', profile);
                this.profileForm.patchValue(profile);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Profile load error:', err);
                setTimeout(() => toast.error('Failed to load profile'), 0);
                this.isLoading = false;
            }
        });
    }

    submit() {
        if (this.profileForm.invalid) {
            setTimeout(() => toast.error('Please fill all fields correctly'), 0);
            return;
        }

        this.isSubmitting = true;
        this.api.put('users/profile', this.profileForm.getRawValue()).subscribe({
            next: () => {
                setTimeout(() => {
                    toast.success('Profile updated successfully');
                    this.isSubmitting = false;
                }, 0);
            },
            error: (err: any) => {
                setTimeout(() => {
                    toast.error(err.error?.message || 'Update failed');
                    this.isSubmitting = false;
                }, 0);
            }
        });
    }
}
