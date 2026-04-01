import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Subscription,
  combineLatest,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { toast } from 'ngx-sonner';
import { Router } from '@angular/router';

import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardInputDirective, ZardSelectDirective } from '@/shared/components/input';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';

import { CreateBeneficiaryPayload, OutreachLocation, OutreachService } from '../outreach.service';

@Component({
  selector: 'app-create-beneficiary',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardInputDirective,
    ZardSelectDirective,
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
  ],
  templateUrl: './create-beneficiary.html',
})
export class CreateBeneficiary implements OnInit, OnDestroy {

  private outreachService = inject(OutreachService);
  private fb              = inject(FormBuilder);
  private authService     = inject(AuthService);
  private router          = inject(Router);

  private subs          = new Subscription();
  private currentUserId = Number(this.authService.getCurrentUser()?.sub) || undefined;

  isSubmitting    = false;
  cachedLocations: OutreachLocation[] = [];

  // ── Dropdown option lists ─────────────────────────────────────────────────

  readonly qualificationOptions = [
    'No Formal Education',
    'Primary (Class 1–5)',
    'Upper Primary (Class 6–8)',
    'Secondary (Class 9–10)',
    'Senior Secondary (Class 11–12)',
    'Diploma / ITI',
    'Graduate',
    'Post Graduate',
    'Other',
  ];

  readonly religionOptions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
  readonly casteOptions    = ['General', 'OBC', 'SC', 'ST', 'NT', 'Other'];
  readonly economicStatusOptions = ['APL', 'BPL'];
  readonly primaryIncomeSourceOptions = [
    'Agriculture', 'Daily Labour', 'Small Business',
    'Government Service', 'Private Service', 'Pension / Remittance', 'Other',
  ];
  readonly employmentStatusOptions = ['Employed', 'Unemployed', 'Self-Employed', 'Student'];

  // ── Form ──────────────────────────────────────────────────────────────────

  form: FormGroup = this.fb.group({
    projectId:                  ['', Validators.required],
    locationId:                 ['', Validators.required],
    state:                      ['', Validators.required],
    district:                   ['', Validators.required],
    block:                      ['', Validators.required],
    village:                    ['', Validators.required],
    name:                       ['', Validators.required],
    mobileNumber:               ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    gender:                     ['', Validators.required],
    dateOfBirth:                ['', Validators.required],
    guardianName:               ['', Validators.required],
    maritalStatus:              ['Single'],
    dateOfMarriage:             [''],
    womanAgeAtMarriage:         [''],
    husbandAgeAtMarriage:       [''],
    qualification:              ['', Validators.required],
    qualificationOther:         [''],
    religion:                   ['', Validators.required],
    religionOther:              [''],
    caste:                      ['', Validators.required],
    casteOther:                 [''],
    monthlyIncome:              ['', [Validators.required, Validators.min(0)]],
    economicStatus:             ['', Validators.required],
    primaryIncomeSource:        ['', Validators.required],
    primaryIncomeSourceOther:   [''],
    employmentStatus:           ['', Validators.required],
  });

  // ── Reactive streams ──────────────────────────────────────────────────────

  projects$ = this.outreachService.getAssignedProjects(this.currentUserId).pipe(startWith([]));

  locations$ = this.form.get('projectId')!.valueChanges.pipe(
    startWith(this.form.get('projectId')!.value),
    switchMap((projectId) =>
      projectId ? this.outreachService.getLocationsByProject(Number(projectId)) : of([])
    ),
    tap((locations) => {
      this.cachedLocations = locations;
      this.form.get('locationId')?.setValue('', { emitEvent: false });
      this.form.patchValue({ state: '', district: '', block: '', village: '' }, { emitEvent: false });
    })
  );

  // ── Derived getters ───────────────────────────────────────────────────────

  get currentGender(): string {
    return String(this.form.get('gender')?.value ?? '').toLowerCase();
  }

  isAgeAutoCalc(field: 'woman' | 'husband'): boolean {
    const g = this.currentGender;
    return (field === 'woman' && g === 'female') || (field === 'husband' && g === 'male');
  }

  isOther(controlName: string): boolean {
    return String(this.form.get(controlName)?.value ?? '') === 'Other';
  }

  isMarried(): boolean {
    return String(this.form.get('maritalStatus')?.value ?? '').toLowerCase() === 'married';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.setupAgeAutoCalculation();
    this.setupLocationPrefill();
    this.setupOtherValidators();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Private setup ─────────────────────────────────────────────────────────

  private setupLocationPrefill(): void {
    const sub = this.form.get('locationId')!.valueChanges.subscribe((locationId) => {
      const loc = this.cachedLocations.find((l) => l.id === Number(locationId));
      if (loc) {
        this.form.patchValue({
          state:    loc.state    || '',
          district: loc.district || '',
          block:    loc.block    || '',
          village:  loc.village  || '',
        }, { emitEvent: false });
      }
    });
    this.subs.add(sub);
  }

  private readonly otherPairs: [string, string][] = [
    ['qualification',       'qualificationOther'],
    ['religion',            'religionOther'],
    ['caste',               'casteOther'],
    ['primaryIncomeSource', 'primaryIncomeSourceOther'],
  ];

  private setupOtherValidators(): void {
    for (const [selectName, otherName] of this.otherPairs) {
      const sub = this.form.get(selectName)!.valueChanges.subscribe((val) => {
        const otherCtrl = this.form.get(otherName)!;
        if (val === 'Other') {
          otherCtrl.setValidators(Validators.required);
        } else {
          otherCtrl.clearValidators();
          otherCtrl.setValue('', { emitEvent: false });
        }
        otherCtrl.updateValueAndValidity({ emitEvent: false });
      });
      this.subs.add(sub);
    }
  }

  private setupAgeAutoCalculation(): void {
    const sub = combineLatest([
      this.form.get('dateOfBirth')!.valueChanges.pipe(startWith('')),
      this.form.get('dateOfMarriage')!.valueChanges.pipe(startWith('')),
      this.form.get('gender')!.valueChanges.pipe(startWith('')),
      this.form.get('maritalStatus')!.valueChanges.pipe(startWith('Single')),
    ]).subscribe(([dob, dom, gender, maritalStatus]) => {
      if (String(maritalStatus).toLowerCase() !== 'married') return;
      const age = this.calculateAgeAtEvent(dob, dom);
      const g = String(gender).toLowerCase();
      
      if (age === null) {
        if (g === 'female') this.form.get('womanAgeAtMarriage')?.setValue('', { emitEvent: false });
        if (g === 'male') this.form.get('husbandAgeAtMarriage')?.setValue('', { emitEvent: false });
        return;
      }
      
      if (g === 'female') {
        this.form.get('womanAgeAtMarriage')?.setValue(age, { emitEvent: false });
      } else if (g === 'male') {
        this.form.get('husbandAgeAtMarriage')?.setValue(age, { emitEvent: false });
      }
    });
    this.subs.add(sub);
  }

  private calculateAgeAtEvent(dobStr: string, eventDateStr: string): number | null {
    if (!dobStr || !eventDateStr) return null;
    const dob   = new Date(dobStr);
    const event = new Date(eventDateStr);
    if (isNaN(dob.getTime()) || isNaN(event.getTime())) return null;
    if (event < dob) return null;
    let age = event.getFullYear() - dob.getFullYear();
    const monthDiff = event.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && event.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  }

  private resolveOther(value: string, otherValue: string): string {
    return value === 'Other' ? String(otherValue || '').trim() : value;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  cancel(): void {
    this.router.navigate(['/outreach/beneficiaries']);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Please fill all required fields');
      return;
    }

    const raw     = this.form.getRawValue();
    const married = this.isMarried();

    if (married && raw.dateOfMarriage && raw.dateOfBirth) {
      const dobDate = new Date(raw.dateOfBirth);
      const domDate = new Date(raw.dateOfMarriage);
      if (domDate < dobDate) {
        toast.error('Date of Marriage cannot be before Date of Birth');
        return;
      }
    }

    const payload: CreateBeneficiaryPayload = {
      projectId:           Number(raw.projectId),
      locationId:          Number(raw.locationId),
      state:               String(raw.state).trim()    || undefined,
      district:            String(raw.district).trim() || undefined,
      block:               String(raw.block).trim()    || undefined,
      village:             String(raw.village).trim()  || undefined,
      mobileNumber:        String(raw.mobileNumber).trim(),
      name:                String(raw.name).trim(),
      gender:              String(raw.gender),
      guardianName:        String(raw.guardianName).trim(),
      dateOfBirth:         new Date(raw.dateOfBirth).toISOString(),
      maritalStatus:       raw.maritalStatus ? String(raw.maritalStatus) : undefined,
      dateOfMarriage:      married && raw.dateOfMarriage
                             ? new Date(raw.dateOfMarriage).toISOString() : undefined,
      womanAgeAtMarriage:  married && raw.womanAgeAtMarriage !== '' && raw.womanAgeAtMarriage !== null
                             ? Number(raw.womanAgeAtMarriage) : undefined,
      husbandAgeAtMarriage: married && raw.husbandAgeAtMarriage !== '' && raw.husbandAgeAtMarriage !== null
                             ? Number(raw.husbandAgeAtMarriage) : undefined,
      qualification:       this.resolveOther(raw.qualification, raw.qualificationOther),
      religion:            this.resolveOther(raw.religion, raw.religionOther),
      caste:               this.resolveOther(raw.caste, raw.casteOther),
      primaryIncomeSource: this.resolveOther(raw.primaryIncomeSource, raw.primaryIncomeSourceOther),
      monthlyIncome:       Number(raw.monthlyIncome),
      economicStatus:      String(raw.economicStatus),
      employmentStatus:    String(raw.employmentStatus),
    };

    this.isSubmitting = true;
    this.outreachService.createBeneficiary(payload).subscribe({
      next: () => {
        toast.success('Beneficiary created successfully');
        this.router.navigate(['/outreach/beneficiaries']);
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Failed to create beneficiary');
        this.isSubmitting = false;
      },
    });
  }
}
