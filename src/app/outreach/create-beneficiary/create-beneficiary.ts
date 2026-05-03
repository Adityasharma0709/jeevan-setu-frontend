import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Subscription,
  combineLatest,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { toast } from 'ngx-sonner';
import { Router } from '@angular/router';

import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardBreadcrumbComponent, ZardBreadcrumbItemComponent } from '@/shared/components/breadcrumb/breadcrumb.component';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';

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
    ZardBreadcrumbComponent,
    ZardBreadcrumbItemComponent,
    ZardComboboxComponent
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

  private mapStringsToOptions = (opts: string[]): ZardComboboxOption[] => 
    opts.map(o => ({ value: o, label: o }));

  readonly qualificationOptions = this.mapStringsToOptions([
    'No Formal Education',
    'Primary (Class 1–5)',
    'Upper Primary (Class 6–8)',
    'Secondary (Class 9–10)',
    'Senior Secondary (Class 11–12)',
    'Diploma / ITI',
    'Graduate',
    'Post Graduate',
    'Other',
  ]);

  readonly religionOptions = this.mapStringsToOptions(['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other']);
  readonly casteOptions    = this.mapStringsToOptions(['General', 'OBC', 'SC', 'ST', 'Other']);
  readonly economicStatusOptions = this.mapStringsToOptions(['APL', 'BPL']);
  readonly primaryIncomeSourceOptions = this.mapStringsToOptions([
    'Agriculture', 'Daily Labour', 'Small Business',
    'Government Service', 'Private Service', 'Pension / Remittance', 'Other',
  ]);
  readonly employmentStatusOptions = this.mapStringsToOptions(['Employed', 'Unemployed', 'Self-Employed', 'Student']);

  readonly genderOptions: ZardComboboxOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }
  ];

  readonly beneficiaryTypeOptions: ZardComboboxOption[] = [
    { value: 'Priority', label: 'Priority' },
    { value: 'Stakeholder', label: 'Stakeholder' },
    { value: 'General', label: 'General' }
  ];

  readonly maritalStatusOptions: ZardComboboxOption[] = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' },
    { value: 'Widowed', label: 'Widowed' },
    { value: 'Divorced', label: 'Divorced' }
  ];

  // ── Form ──────────────────────────────────────────────────────────────────

  form: FormGroup = this.fb.group({
    projectId:                  ['', Validators.required],
    stateSelect:                [''],
    districtSelect:             [''],
    blockSelect:                [''],
    villageSelect:              [''],
    locationId:                 ['', Validators.required],
    beneficiaryType:            ['General', Validators.required],
    name:                       ['', Validators.required],
    mobileNumber:               ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
    gender:                     ['', Validators.required],
    dateOfBirth:                ['', Validators.required],
    age:                        [''],
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

  projects$ = this.outreachService.getAssignedProjects(this.currentUserId).pipe(
    startWith([]),
    map(projects => projects.map(p => ({ value: p.id.toString(), label: p.name })))
  );

  private extractName(item: any, field: string): string {
    if (!item) return '';
    // Check item directly, then in .location, then in .awc, then in .state (for state specifically)
    let val = item[field];
    if (!val && item.location) val = item.location[field];
    if (!val && item.awc) val = item.awc[field];
    
    // Special case for state which is often an object itself
    if (field === 'state' && !val && item.stateId) val = item.state;

    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.name || val.awcName || val.locationCode || '';
  }

  projectAssignments$ = this.form.get('projectId')!.valueChanges.pipe(
    startWith(this.form.get('projectId')!.value),
    switchMap((projectId) =>
      projectId ? this.outreachService.getProjectAssignments(Number(projectId)) : of({ states: [], awcs: [] })
    ),
    shareReplay(1)
  );

  locationsByProject$ = this.projectAssignments$.pipe(
    map(res => res.awcs),
    tap((locations) => {
      this.cachedLocations = locations;
      // Reset all assignments when project changes
      this.form.patchValue({ 
        stateSelect: '', 
        districtSelect: '', 
        blockSelect: '', 
        villageSelect: '', 
        locationId: '' 
      }, { emitEvent: true });
    }),
    shareReplay(1)
  );

  assignmentStates$ = this.projectAssignments$.pipe(
    map((res) => {
      // Use explicit states from backend, or derive from AWCs if none explicitly listed
      let states = res.states.map(s => this.extractName(s, 'name')).filter(Boolean);
      if (states.length === 0) {
        states = Array.from(new Set(res.awcs.map(l => this.extractName(l, 'state')).filter(Boolean)));
      }
      return states.sort().map(s => ({ value: s, label: s } as ZardComboboxOption));
    })
  );

  assignmentDistricts$ = combineLatest([
    this.locationsByProject$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value))
  ]).pipe(
    tap(([_, state]) => {
      if (state !== undefined) {
        this.form.patchValue({ districtSelect: '', blockSelect: '', villageSelect: '', locationId: '' }, { emitEvent: false });
      }
    }),
    map(([locs, state]: [OutreachLocation[], string]): ZardComboboxOption[] => {
      if (!state) return [] as ZardComboboxOption[];
      const districts = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state)
            .map(l => this.extractName(l, 'district'))
            .filter(Boolean)
      ));
      return districts.sort().map(d => ({ value: d, label: d } as ZardComboboxOption));
    })
  );

  assignmentBlocks$ = combineLatest([
    this.locationsByProject$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value))
  ]).pipe(
    tap(([_, __, district]) => {
      if (district !== undefined) {
        this.form.patchValue({ blockSelect: '', villageSelect: '', locationId: '' }, { emitEvent: false });
      }
    }),
    map(([locs, state, district]: [OutreachLocation[], string, string]): ZardComboboxOption[] => {
      if (!state || !district) return [] as ZardComboboxOption[];
      const blocks = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state && this.extractName(l, 'district') === district)
            .map(l => this.extractName(l, 'block'))
            .filter(Boolean)
      ));
      return blocks.sort().map(b => ({ value: b, label: b } as ZardComboboxOption));
    })
  );

  assignmentVillages$ = combineLatest([
    this.locationsByProject$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value))
  ]).pipe(
    tap(([_, __, ___, block]) => {
      if (block !== undefined) {
        this.form.patchValue({ villageSelect: '', locationId: '' }, { emitEvent: false });
      }
    }),
    map(([locs, state, district, block]: [OutreachLocation[], string, string, string]): ZardComboboxOption[] => {
      if (!state || !district || !block) return [] as ZardComboboxOption[];
      const villages = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state && this.extractName(l, 'district') === district && this.extractName(l, 'block') === block)
            .map(l => this.extractName(l, 'village'))
            .filter(Boolean)
      ));
      return villages.sort().map(v => ({ value: v, label: v } as ZardComboboxOption));
    })
  );

  assignmentAwcs$ = combineLatest([
    this.locationsByProject$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value)),
    this.form.get('villageSelect')!.valueChanges.pipe(startWith(this.form.get('villageSelect')!.value))
  ]).pipe(
    tap(([_, __, ___, ____, village]) => {
      if (village !== undefined) {
        this.form.patchValue({ locationId: '' }, { emitEvent: false });
      }
    }),
    map(([locs, state, district, block, village]: [OutreachLocation[], string, string, string, string]): ZardComboboxOption[] => {
      if (!state || !district || !block || !village) return [] as ZardComboboxOption[];
      return locs
        .filter(l => 
          this.extractName(l, 'state') === state && 
          this.extractName(l, 'district') === district && 
          this.extractName(l, 'block') === block && 
          this.extractName(l, 'village') === village
        )
        .map(l => {
          const awcName = (l as any).awcName || '';
          const label = awcName ? `${l.locationCode} - ${awcName}` : `${l.locationCode} - ${this.extractName(l, 'village')}`;
          return { value: l.id.toString(), label } as ZardComboboxOption;
        });
    })
  );

  // ── Derived getters ───────────────────────────────────────────────────────

  get currentGender(): string {
    return String(this.form.get('gender')?.value ?? '').toLowerCase();
  }

  get isPriority(): boolean {
    return this.form.get('beneficiaryType')?.value === 'Priority';
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
    this.setupOtherValidators();
    this.setupPriorityValidators();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Private setup ─────────────────────────────────────────────────────────


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

  private setupPriorityValidators(): void {
    const priorityFields = [
      'guardianName',
      'qualification',
      'religion',
      'caste',
      'monthlyIncome',
      'economicStatus',
      'primaryIncomeSource',
      'employmentStatus'
    ];

    const sub = this.form.get('beneficiaryType')!.valueChanges.pipe(
      startWith(this.form.get('beneficiaryType')!.value)
    ).subscribe(type => {
      const isPriority = type === 'Priority';
      
      priorityFields.forEach(field => {
        const ctrl = this.form.get(field)!;
        if (isPriority) {
          if (field === 'monthlyIncome') {
            ctrl.setValidators([Validators.required, Validators.min(0)]);
          } else {
            ctrl.setValidators(Validators.required);
          }
        } else {
          ctrl.clearValidators();
        }
        ctrl.updateValueAndValidity({ emitEvent: false });
      });

      // Age vs DOB
      const dobCtrl = this.form.get('dateOfBirth')!;
      const ageCtrl = this.form.get('age')!;
      if (isPriority) {
        dobCtrl.setValidators(Validators.required);
        ageCtrl.clearValidators();
      } else {
        dobCtrl.clearValidators();
        ageCtrl.setValidators([Validators.required, Validators.min(0), Validators.max(120)]);
      }
      dobCtrl.updateValueAndValidity({ emitEvent: false });
      ageCtrl.updateValueAndValidity({ emitEvent: false });

      // AWC (locationId)
      const locCtrl = this.form.get('locationId')!;
      if (isPriority) {
        locCtrl.setValidators(Validators.required);
      } else {
        locCtrl.clearValidators();
      }
      locCtrl.updateValueAndValidity({ emitEvent: false });
    });
    this.subs.add(sub);
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
      beneficiaryType:     String(raw.beneficiaryType),
      projectId:           Number(raw.projectId),
      locationId:          this.isPriority ? Number(raw.locationId) : undefined,
      state:               raw.stateSelect || undefined,
      district:            raw.districtSelect || undefined,
      block:               raw.blockSelect || undefined,
      village:             raw.villageSelect || undefined,
      mobileNumber:        String(raw.mobileNumber).trim(),
      name:                String(raw.name).trim(),
      gender:              String(raw.gender),
      guardianName:        this.isPriority ? String(raw.guardianName).trim() : undefined,
      dateOfBirth:         this.isPriority 
                             ? new Date(raw.dateOfBirth).toISOString()
                             : new Date(new Date().getFullYear() - Number(raw.age || 0), 0, 1).toISOString(),
      maritalStatus:       raw.maritalStatus ? String(raw.maritalStatus) : undefined,
      dateOfMarriage:      married && raw.dateOfMarriage
                             ? new Date(raw.dateOfMarriage).toISOString() : undefined,
      womanAgeAtMarriage:  married && raw.womanAgeAtMarriage !== '' && raw.womanAgeAtMarriage !== null
                             ? Number(raw.womanAgeAtMarriage) : undefined,
      husbandAgeAtMarriage: married && raw.husbandAgeAtMarriage !== '' && raw.husbandAgeAtMarriage !== null
                             ? Number(raw.husbandAgeAtMarriage) : undefined,
      qualification:       this.isPriority ? this.resolveOther(raw.qualification, raw.qualificationOther) : undefined,
      religion:            this.isPriority ? this.resolveOther(raw.religion, raw.religionOther) : undefined,
      caste:               this.isPriority ? this.resolveOther(raw.caste, raw.casteOther) : undefined,
      primaryIncomeSource: this.isPriority ? this.resolveOther(raw.primaryIncomeSource, raw.primaryIncomeSourceOther) : undefined,
      monthlyIncome:       this.isPriority ? Number(raw.monthlyIncome) : undefined,
      economicStatus:      this.isPriority ? String(raw.economicStatus) : undefined,
      employmentStatus:    this.isPriority ? String(raw.employmentStatus) : undefined,
    };

    this.isSubmitting = true;
    this.outreachService.createBeneficiary(payload).subscribe({
      next: () => {
        toast.success('Beneficiary created successfully');
        this.router.navigate(['/outreach/beneficiaries']);
      },
      error: (err) => {
        const msg = err?.error?.message;
        const errorMsg = Array.isArray(msg) ? msg[0] : (msg || 'Failed to create beneficiary');
        toast.error(errorMsg);
        this.isSubmitting = false;
      },
    });
  }
}
