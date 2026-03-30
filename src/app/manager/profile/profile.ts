import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { ManagerService } from '../manager.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';

@Component({
  selector: 'app-profile',
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

  constructor(
    private fb: FormBuilder,
    private managerService: ManagerService
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
    this.managerService.getProfile().subscribe({
      next: (profile) => {
        const mobile = profile?.mobileNumber ?? profile?.mobile ?? '';
        this.profileForm.patchValue(
          {
            name: profile?.name ?? '',
            email: profile?.email ?? '',
            mobile,
          },
          { emitEvent: false },
        );
      },
      error: () => {
        toast.error('Failed to load profile');
      }
    });
  }

  submit() {
    if (this.profileForm.invalid) {
      toast.error('Please fill all fields correctly');
      return;
    }

    this.isSubmitting = true;
    this.managerService.updateProfile(this.profileForm.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting = false;
        setTimeout(() => toast.success('Profile updated successfully'));
      },
      error: (err) => {
        this.isSubmitting = false;
        setTimeout(() => toast.error(err.error?.message || 'Update failed'));
      }
    });
  }
}
