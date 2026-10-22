import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toast } from 'ngx-sonner';
import { forkJoin, of, Observable, BehaviorSubject, defer, combineLatest } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

import { ApiService } from '@/core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardFormControlComponent, ZardFormFieldComponent } from '@/shared/components/form';
import { ZardInputDirective } from '@/shared/components/input';

import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { OutreachService, Beneficiary, OutreachLocation } from '../outreach.service';

@Component({
  selector: 'app-request-update',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardFormControlComponent,
    ZardFormFieldComponent,
    ZardInputDirective,
    ZardComboboxComponent
  ],
  templateUrl: './request-update.html',
})
export class RequestUpdate implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private outreachService = inject(OutreachService);
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  beneficiary: Beneficiary | null = null;
  loading = true;
  isSubmitting = false;
  private isHydrating = false;

  // ── Datasets ─────────────────────────────────────────────────────────────
  private locations$ = new BehaviorSubject<OutreachLocation[]>([]);
  private schools$ = new BehaviorSubject<any[]>([]);
  private healthCenters$ = new BehaviorSubject<any[]>([]);
  private states$ = new BehaviorSubject<ZardComboboxOption[]>([]);

  form: FormGroup = this.fb.group({
    beneficiaryType: ['General', Validators.required],
    name: [''],
    mobileNumber: ['', [Validators.pattern('^[0-9]{10}$')]],
    gender: [''],
    guardianName: [''],
    dateOfBirth: [''],
    age: [''],
    maritalStatus: [''],
    dateOfMarriage: [''],
    womanAgeAtMarriage: [''],
    husbandAgeAtMarriage: [''],
    qualification: [''],
    religion: [''],
    caste: [''],
    monthlyIncome: [''],
    economicStatus: [''],
    primaryIncomeSource: [''],
    employmentStatus: [''],

    // Location Fields
    stateSelect: [''],
    districtSelect: [''],
    blockSelect: [''],
    villageSelect: [''],
    institutionTypeSelect: ['NONE'],
    locationId: [''],
    schoolId: [''],
    healthCenterId: [''],
  });

  readonly genderOptions: ZardComboboxOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }
  ];

  readonly institutionTypeOptions: ZardComboboxOption[] = [
    { value: 'NONE', label: 'None' },
    { value: 'AWC', label: 'Anganwadi Center (AWC)' },
    { value: 'SCHOOL', label: 'School' },
    { value: 'HEALTH_CENTER', label: 'Health Center' }
  ];

  private mapStringsToOptions = (opts: string[]): ZardComboboxOption[] => 
    opts.map(o => ({ value: o, label: o }));

  readonly qualificationOptions = this.mapStringsToOptions([
    'No Formal Education', 'Primary (Class 1–5)', 'Upper Primary (Class 6–8)',
    'Secondary (Class 9–10)', 'Senior Secondary (Class 11–12)', 'Diploma / ITI',
    'Graduate', 'Post Graduate', 'Other',
  ]);

  readonly religionOptions = this.mapStringsToOptions(['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other']);
  readonly casteOptions    = this.mapStringsToOptions(['General', 'OBC', 'SC', 'ST', 'Other']);
  readonly economicStatusOptions = this.mapStringsToOptions(['AAY', 'PHH', 'Others']);
  readonly primaryIncomeSourceOptions = this.mapStringsToOptions([
    'Agriculture', 'Daily Labour', 'Small Business', 'Government Service', 'Private Service', 'Pension / Remittance', 'Other',
  ]);
  readonly employmentStatusOptions = this.mapStringsToOptions(['Working', 'Not-Working', 'Daily-Wage-Earner', 'Self-Employed']);

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

  // ── Cascading Reactive Streams ──────────────────────────────────────────

  assignmentStates$ = this.states$.asObservable();

  assignmentDistricts$ = defer(() => combineLatest([
    this.locations$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value))
  ]).pipe(
    map(([locs, state]): ZardComboboxOption[] => {
      if (!state) return [];
      const districts = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state)
            .map(l => this.extractName(l, 'district'))
            .filter(Boolean)
      ));
      return districts.sort().map(d => ({ value: d, label: d }));
    })
  ));

  assignmentBlocks$ = defer(() => combineLatest([
    this.locations$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value))
  ]).pipe(
    map(([locs, state, district]): ZardComboboxOption[] => {
      if (!state || !district) return [];
      const blocks = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state && this.extractName(l, 'district') === district)
            .map(l => this.extractName(l, 'block'))
            .filter(Boolean)
      ));
      return blocks.sort().map(b => ({ value: b, label: b }));
    })
  ));

  assignmentVillages$ = defer(() => combineLatest([
    this.locations$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value))
  ]).pipe(
    map(([locs, state, district, block]): ZardComboboxOption[] => {
      if (!state || !district || !block) return [];
      const villages = Array.from(new Set(
        locs.filter(l => this.extractName(l, 'state') === state && this.extractName(l, 'district') === district && this.extractName(l, 'block') === block)
            .map(l => this.extractName(l, 'village'))
            .filter(Boolean)
      ));
      return villages.sort().map(v => ({ value: v, label: v }));
    })
  ));

  assignmentAwcs$ = defer(() => combineLatest([
    this.locations$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value)),
    this.form.get('villageSelect')!.valueChanges.pipe(startWith(this.form.get('villageSelect')!.value))
  ]).pipe(
    map(([locs, state, district, block, village]): ZardComboboxOption[] => {
      if (!state || !district || !block || !village) return [];
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
          return { value: l.id.toString(), label };
        });
    })
  ));

  assignmentSchools$ = defer(() => combineLatest([
    this.schools$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value)),
    this.form.get('villageSelect')!.valueChanges.pipe(startWith(this.form.get('villageSelect')!.value))
  ]).pipe(
    map(([schools, state, district, block, village]): ZardComboboxOption[] => {
      if (!state || !district || !block || !village) return [];
      return (schools || [])
        .filter((l: any) => {
          const sState = this.extractName(l, 'state') || l.stateName || '';
          const sDist = this.extractName(l, 'district') || l.districtName || '';
          const sBlock = this.extractName(l, 'block') || l.blockName || '';
          const sVill = this.extractName(l, 'village') || l.villageName || '';
          return (
            sState.trim().toLowerCase() === state.trim().toLowerCase() &&
            sDist.trim().toLowerCase() === district.trim().toLowerCase() &&
            sBlock.trim().toLowerCase() === block.trim().toLowerCase() &&
            sVill.trim().toLowerCase() === village.trim().toLowerCase() &&
            (l.status === undefined || l.status === 'ACTIVE')
          );
        })
        .map((l: any) => {
          const label = l.name ? `${l.locationCode} - ${l.name}` : `${l.locationCode} - ${this.extractName(l, 'village') || l.villageName}`;
          return { value: l.id.toString(), label };
        });
    })
  ));

  assignmentHealthCenters$ = defer(() => combineLatest([
    this.healthCenters$,
    this.form.get('stateSelect')!.valueChanges.pipe(startWith(this.form.get('stateSelect')!.value)),
    this.form.get('districtSelect')!.valueChanges.pipe(startWith(this.form.get('districtSelect')!.value)),
    this.form.get('blockSelect')!.valueChanges.pipe(startWith(this.form.get('blockSelect')!.value)),
    this.form.get('villageSelect')!.valueChanges.pipe(startWith(this.form.get('villageSelect')!.value))
  ]).pipe(
    map(([hcs, state, district, block, village]): ZardComboboxOption[] => {
      if (!state || !district || !block || !village) return [];
      return (hcs || [])
        .filter((l: any) => {
          const sState = this.extractName(l, 'state') || l.stateName || '';
          const sDist = this.extractName(l, 'district') || l.districtName || '';
          const sBlock = this.extractName(l, 'block') || l.blockName || '';
          const sVill = this.extractName(l, 'village') || l.villageName || '';
          return (
            sState.trim().toLowerCase() === state.trim().toLowerCase() &&
            sDist.trim().toLowerCase() === district.trim().toLowerCase() &&
            sBlock.trim().toLowerCase() === block.trim().toLowerCase() &&
            sVill.trim().toLowerCase() === village.trim().toLowerCase() &&
            (l.status === undefined || l.status === 'ACTIVE')
          );
        })
        .map((l: any) => {
          const label = l.name ? `${l.locationCode} - ${l.name}` : `${l.locationCode} - ${this.extractName(l, 'village') || l.villageName}`;
          return { value: l.id.toString(), label };
        });
    })
  ));

  ngOnInit() {
    this.setupCascadingListeners();
    const id = +this.route.snapshot.params['id'];
    const stateData = history.state?.beneficiary;

    if (stateData && stateData.id === id) {
      this.loadProjectLocationsAndPatch(stateData);
    } else {
      this.outreachService.getBeneficiary(id).subscribe({
        next: (b) => {
          this.loadProjectLocationsAndPatch(b);
        },
        error: () => {
          toast.error('Beneficiary not found');
          this.router.navigate(['/outreach/beneficiaries']);
        }
      });
    }
  }

  private loadProjectLocationsAndPatch(b: Beneficiary): void {
    this.beneficiary = b;
    this.loading = true;

    forkJoin({
      assignments: this.outreachService.getProjectAssignments(b.projectId).pipe(catchError(() => of({ states: [], awcs: [] }))),
      schools: (this.api.get(`locations/schools?projectId=${b.projectId}`) as Observable<any[]>).pipe(catchError(() => of([]))),
      healthCenters: (this.api.get(`locations/health-centers?projectId=${b.projectId}`) as Observable<any[]>).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ assignments, schools, healthCenters }) => {
        const rawLocations = assignments.awcs || [];
        this.locations$.next(rawLocations);
        this.schools$.next(schools || []);
        this.healthCenters$.next(healthCenters || []);

        let stateOptions = (assignments.states || []).map((s: any) => this.extractName(s, 'name')).filter(Boolean);
        if (stateOptions.length === 0) {
          stateOptions = Array.from(new Set(rawLocations.map((l: any) => this.extractName(l, 'state')).filter(Boolean)));
        }
        this.states$.next(stateOptions.sort().map((s: string) => ({ value: s, label: s })));

        this.patchForm(b);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.patchForm(b);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private setupCascadingListeners(): void {
    this.form.get('stateSelect')!.valueChanges.subscribe(() => {
      if (this.isHydrating) return;
      this.form.patchValue({
        districtSelect: '',
        blockSelect: '',
        villageSelect: '',
        locationId: '',
        schoolId: '',
        healthCenterId: ''
      });
    });

    this.form.get('districtSelect')!.valueChanges.subscribe(() => {
      if (this.isHydrating) return;
      this.form.patchValue({
        blockSelect: '',
        villageSelect: '',
        locationId: '',
        schoolId: '',
        healthCenterId: ''
      });
    });

    this.form.get('blockSelect')!.valueChanges.subscribe(() => {
      if (this.isHydrating) return;
      this.form.patchValue({
        villageSelect: '',
        locationId: '',
        schoolId: '',
        healthCenterId: ''
      });
    });

    this.form.get('villageSelect')!.valueChanges.subscribe(() => {
      if (this.isHydrating) return;
      this.form.patchValue({
        locationId: '',
        schoolId: '',
        healthCenterId: ''
      });
    });
  }

  onInstitutionTypeChange(newType: string): void {
    if (this.isHydrating) return;
    this.form.patchValue({
      locationId: '',
      schoolId: '',
      healthCenterId: ''
    });
  }

  private extractName(item: any, field: string): string {
    if (!item) return '';
    let val = item[field];
    if (!val && item.location) val = item.location[field];
    if (!val && item.awc) val = item.awc[field];
    if (field === 'state' && !val && item.stateId) val = item.state;

    if (!val) return '';
    if (typeof val === 'string') return val;
    return val.name || val.awcName || val.locationCode || '';
  }

  isMarried(): boolean {
    return String(this.form.get('maritalStatus')?.value || '').toLowerCase() === 'married';
  }

  get isPriority(): boolean {
    return this.form.get('beneficiaryType')?.value === 'Priority';
  }

  private parseDateStr(dateStr: string): Date | null {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const p = dateStr.split('/');
      if (p.length === 3) {
        const day = Number(p[0]), month = Number(p[1]) - 1, year = Number(p[2]);
        const d = new Date(year, month, day);
        if (d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) return d;
      }
    } else {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  private calculateAge(dobStr: string): number {
    if (!dobStr) return 0;
    const dob = this.parseDateStr(dobStr) || new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  private toIsoDateString(dateStr: string): string | null {
    const date = this.parseDateStr(dateStr);
    return date ? date.toISOString() : null;
  }

  /** Convert an ISO date string from DB to DD/MM/YYYY for display */
  private toDDMMYYYY(value: string): string {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return ''; }
  }

  formatDateInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    let formatted = val;
    if (val.length > 4) formatted = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);
    else if (val.length > 2) formatted = val.substring(0, 2) + '/' + val.substring(2, 4);
    this.form.get(controlName)?.setValue(formatted, { emitEvent: false });
  }

  openPicker(picker: HTMLInputElement) {
    try { picker.showPicker(); } catch { picker.focus(); }
  }

  getNativeDateValue(controlName: string): string {
    const val = this.form.get(controlName)?.value;
    const d = this.parseDateStr(val);
    if (d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    return '';
  }

  onNativeDateChange(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      const parts = input.value.split('-');
      if (parts.length === 3) {
        this.form.get(controlName)?.setValue(`${parts[2]}/${parts[1]}/${parts[0]}`);
        this.form.get(controlName)?.markAsTouched();
      }
    }
  }

  private patchForm(b: Beneficiary) {
    this.isHydrating = true;

    const hasPriorityData = !!(b.guardianName || b.qualification || b.religion || b.caste);
    const type = b.typeof ? b.typeof : (hasPriorityData ? 'Priority' : 'General');

    const existingInstType = b.locationId || (b as any).awcId ? 'AWC' 
      : (b as any).schoolId ? 'SCHOOL' 
      : (b as any).healthCenterId ? 'HEALTH_CENTER' 
      : 'NONE';

    const awcVal = b.locationId || (b as any).awcId ? String(b.locationId || (b as any).awcId) : '';
    const schoolVal = (b as any).schoolId ? String((b as any).schoolId) : '';
    const hcVal = (b as any).healthCenterId ? String((b as any).healthCenterId) : '';

    const stateVal = b.state || this.extractName(b.location, 'state') || '';
    const districtVal = b.district || this.extractName(b.location, 'district') || '';
    const blockVal = b.block || this.extractName(b.location, 'block') || '';
    const villageVal = b.village || this.extractName(b.location, 'village') || '';

    this.form.patchValue({
      beneficiaryType: type,
      name: b.name || '',
      mobileNumber: b.mobileNumber || '',
      gender: b.gender || '',
      guardianName: b.guardianName || '',
      dateOfBirth: b.dateOfBirth ? this.toDDMMYYYY(b.dateOfBirth) : '',
      age: b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : '',
      maritalStatus: b.maritalStatus || '',
      dateOfMarriage: b.dateOfMarriage ? this.toDDMMYYYY(b.dateOfMarriage) : '',
      womanAgeAtMarriage: b.womanAgeAtMarriage ?? '',
      husbandAgeAtMarriage: b.husbandAgeAtMarriage ?? '',
      qualification: b.qualification || '',
      religion: b.religion || '',
      caste: b.caste || '',
      monthlyIncome: b.monthlyIncome ?? '',
      economicStatus: b.economicStatus || '',
      primaryIncomeSource: b.primaryIncomeSource || '',
      employmentStatus: b.employmentStatus || '',

      stateSelect: stateVal,
      districtSelect: districtVal,
      blockSelect: blockVal,
      villageSelect: villageVal,
      institutionTypeSelect: existingInstType,
      locationId: awcVal,
      schoolId: schoolVal,
      healthCenterId: hcVal,
    }, { emitEvent: false });

    this.isHydrating = false;
  }

  goBack() { history.back(); }

  submit() {
    if (!this.beneficiary) return;
    const raw = this.form.getRawValue();
    const b = this.beneficiary;
    const changes: Record<string, any> = {};

    if (raw.name && raw.name !== b.name) changes['name'] = String(raw.name);
    if (raw.mobileNumber && raw.mobileNumber !== b.mobileNumber) changes['mobileNumber'] = String(raw.mobileNumber);
    if (raw.gender && raw.gender !== b.gender) changes['gender'] = String(raw.gender);
    if (raw.beneficiaryType && raw.beneficiaryType !== b.typeof) {
      changes['beneficiaryType'] = String(raw.beneficiaryType);
      changes['typeof'] = String(raw.beneficiaryType);
    }
    
    // DOB / Age handling - always normalize to ISO before submit
    if (this.isPriority) {
      const currentDob = b.dateOfBirth ? this.toDDMMYYYY(b.dateOfBirth) : '';
      if (raw.dateOfBirth && raw.dateOfBirth !== currentDob) {
        const isoDob = this.toIsoDateString(raw.dateOfBirth);
        if (isoDob) changes['dateOfBirth'] = isoDob;
      }
    } else if (raw.age !== '') {
      const currentAge = b.dateOfBirth ? this.calculateAge(b.dateOfBirth) : -1;
      if (Number(raw.age) !== currentAge) {
        const y = new Date().getFullYear() - Number(raw.age);
        changes['dateOfBirth'] = new Date(y, 0, 1).toISOString();
      }
    }

    if (this.isPriority) {
      if (raw.guardianName && raw.guardianName !== b.guardianName) changes['guardianName'] = String(raw.guardianName);
      if (raw.qualification && raw.qualification !== b.qualification) changes['qualification'] = String(raw.qualification);
      if (raw.religion && raw.religion !== b.religion) changes['religion'] = String(raw.religion);
      if (raw.caste && raw.caste !== b.caste) changes['caste'] = String(raw.caste);
      if (raw.monthlyIncome !== '' && Number(raw.monthlyIncome) !== Number(b.monthlyIncome)) changes['monthlyIncome'] = Number(raw.monthlyIncome);
      if (raw.primaryIncomeSource && raw.primaryIncomeSource !== b.primaryIncomeSource) changes['primaryIncomeSource'] = String(raw.primaryIncomeSource);
      if (raw.economicStatus && raw.economicStatus !== b.economicStatus) changes['economicStatus'] = String(raw.economicStatus);
      if (raw.employmentStatus && raw.employmentStatus !== b.employmentStatus) changes['employmentStatus'] = String(raw.employmentStatus);
      if (raw.maritalStatus && raw.maritalStatus !== b.maritalStatus) changes['maritalStatus'] = String(raw.maritalStatus);

      if (this.isMarried()) {
        const currentDom = b.dateOfMarriage ? this.toDDMMYYYY(b.dateOfMarriage) : '';
        if (raw.dateOfMarriage && raw.dateOfMarriage !== currentDom) {
          const isoDom = this.toIsoDateString(raw.dateOfMarriage);
          if (isoDom) changes['dateOfMarriage'] = isoDom;
        }
        if (raw.womanAgeAtMarriage !== '' && Number(raw.womanAgeAtMarriage) !== Number(b.womanAgeAtMarriage)) changes['womanAgeAtMarriage'] = Number(raw.womanAgeAtMarriage);
        if (raw.husbandAgeAtMarriage !== '' && Number(raw.husbandAgeAtMarriage) !== Number(b.husbandAgeAtMarriage)) changes['husbandAgeAtMarriage'] = Number(raw.husbandAgeAtMarriage);
      }
    }

    // Location diffing
    const origState = b.state || this.extractName(b.location, 'state') || '';
    const origDist = b.district || this.extractName(b.location, 'district') || '';
    const origBlock = b.block || this.extractName(b.location, 'block') || '';
    const origVill = b.village || this.extractName(b.location, 'village') || '';

    if (raw.stateSelect && raw.stateSelect !== origState) changes['state'] = String(raw.stateSelect);
    if (raw.districtSelect && raw.districtSelect !== origDist) changes['district'] = String(raw.districtSelect);
    if (raw.blockSelect && raw.blockSelect !== origBlock) changes['block'] = String(raw.blockSelect);
    if (raw.villageSelect && raw.villageSelect !== origVill) changes['village'] = String(raw.villageSelect);

    const instType = raw.institutionTypeSelect;
    const newAwcId = (instType === 'AWC' && raw.locationId) ? Number(raw.locationId) : null;
    const oldAwcId = (b.locationId || (b as any).awcId) ? Number(b.locationId || (b as any).awcId) : null;
    if (newAwcId !== oldAwcId) {
      changes['locationId'] = newAwcId;
      changes['awcId'] = newAwcId;
    }

    const newSchoolId = (instType === 'SCHOOL' && raw.schoolId) ? Number(raw.schoolId) : null;
    const oldSchoolId = (b as any).schoolId ? Number((b as any).schoolId) : null;
    if (newSchoolId !== oldSchoolId) {
      changes['schoolId'] = newSchoolId;
    }

    const newHcId = (instType === 'HEALTH_CENTER' && raw.healthCenterId) ? Number(raw.healthCenterId) : null;
    const oldHcId = (b as any).healthCenterId ? Number((b as any).healthCenterId) : null;
    if (newHcId !== oldHcId) {
      changes['healthCenterId'] = newHcId;
    }

    if (!Object.keys(changes).length) {
      toast.error('No changes detected');
      return;
    }

    this.isSubmitting = true;
    this.outreachService.requestBeneficiaryUpdate(this.beneficiary.id, changes).subscribe({
      next: () => {
        toast.success('Update request submitted for manager approval');
        this.router.navigate(['/outreach/beneficiary', this.beneficiary!.id]);
      },
      error: (err: any) => {
        setTimeout(() => {
          const msg = err?.error?.message;
          const errorMsg = Array.isArray(msg) ? msg[0] : (msg || 'Failed to submit update');
          toast.error(errorMsg);
          this.isSubmitting = false;
        }, 0);
      },
    });
  }
}
