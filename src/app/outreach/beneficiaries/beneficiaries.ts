import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable, Subject, startWith, switchMap, of, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { ApiService } from '@/core/services/api';

import { ZardProgressBarComponent } from '@/shared/components/progress-bar/progress-bar.component';
import {
  ZardFormFieldComponent,
  ZardFormControlComponent
} from '@/shared/components/form';
import { ZardButtonComponent } from '@/shared/components/button';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardInputDirective, ZardSelectDirective } from '@/shared/components/input';

interface Project {
  id: number;
  name: string;
}

interface LocationModel {
  id: number;
  projectId: number;
  locationCode: string;
  state: string;
  district: string;
  block: string;
  village: string;
  status: string;
}

@Component({
  selector: 'app-beneficiaries',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ZardProgressBarComponent,
    ZardFormFieldComponent,
    ZardFormControlComponent,
    ZardButtonComponent,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardInputDirective,
    ZardSelectDirective,
  ],
  templateUrl: './beneficiaries.html',
})
export class Beneficiaries implements OnInit {

  form!: FormGroup;

  step = 1;
  totalSteps = 4;

  viewMode: 'list' | 'form' = 'list';

  // ==============================
  // 🔥 REFRESH STREAM
  // ==============================

  private refresh$ = new Subject<void>();

  projects$: Observable<Project[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.api.get('projects') as Observable<Project[]>
    )
  );

  beneficiaries$: Observable<any[]> = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() =>
      this.api.get('outreach/beneficiary-list') as Observable<any[]>
    )
  );

  // ==============================
  // 🔥 LOCATIONS STREAM
  // ==============================

  locations$!: Observable<LocationModel[]>;

  constructor(private fb: FormBuilder, private api: ApiService) { }

  ngOnInit() {
    this.form = this.fb.group({

      projectId: ['', Validators.required],
      locationId: ['', Validators.required],

      mobileNumber: ['', Validators.required],
      name: ['', Validators.required],
      gender: ['', Validators.required],
      guardianName: ['', Validators.required],
      dateOfBirth: ['', Validators.required],

      maritalStatus: [''],
      dateOfMarriage: [''],
      womanAgeAtMarriage: [''],
      husbandAgeAtMarriage: [''],

      qualification: ['', Validators.required],
      religion: ['', Validators.required],
      caste: ['', Validators.required],

      monthlyIncome: ['', Validators.required],
      economicStatus: ['', Validators.required],
      primaryIncomeSource: ['', Validators.required],
      employmentStatus: ['', Validators.required],
    });

    // 🔥 Project → Location reactive pipeline

    this.locations$ = this.form.get('projectId')!.valueChanges.pipe(

      tap(() => {
        // reset location when project changes
        this.form.patchValue({ locationId: '' });
      }),

      switchMap(projectId => {
        if (!projectId) return of([]);
        return this.api.get(
          `locations?projectId=${projectId}`
        ) as Observable<LocationModel[]>;
      })
    );

    // trigger initial fetch
    this.refresh$.next();
  }

  // ==============================
  // UI Helpers
  // ==============================

  get progress(): number {
    return Math.round((this.step / this.totalSteps) * 100);
  }

  toggleView() {
    this.viewMode = this.viewMode === 'list' ? 'form' : 'list';
    if (this.viewMode === 'form') {
      this.step = 1;
      this.form.reset();
    }
  }

  next() {
    if (this.step < this.totalSteps) this.step++;
  }

  prev() {
    if (this.step > 1) this.step--;
  }

  isMarried(): boolean {
    return this.form.value.maritalStatus === 'Married';
  }

  submit() {
    const rawValue = this.form.value;

    const payload = {
      ...rawValue,
      projectId: Number(rawValue.projectId),
      locationId: Number(rawValue.locationId),
      monthlyIncome: Number(rawValue.monthlyIncome),
      womanAgeAtMarriage: rawValue.womanAgeAtMarriage ? Number(rawValue.womanAgeAtMarriage) : null,
      husbandAgeAtMarriage: rawValue.husbandAgeAtMarriage ? Number(rawValue.husbandAgeAtMarriage) : null,
    };

    console.log(payload);

    this.api
      .post('outreach/beneficiary', payload)
      .subscribe({
        next: () => {
          toast.success('Beneficiary saved successfully');
          this.refresh$.next();
          this.toggleView();
        },
        error: err => {
          console.error(err);
          if (err.status === 403) {
            toast.error(err.error?.message || 'You are not valid to perform this action');
          } else if (err.status === 400) {
            toast.error(err.error?.message || 'Bad Request');
          } else {
            toast.error('Something went wrong');
          }
        }
      });
  }

  delete(id: number) {
    if (!confirm('Are you sure you want to delete this beneficiary?')) return;

    this.api.delete(`outreach/beneficiary/${id}`).subscribe({
      next: () => {
        this.refresh$.next();
      },
      error: err => {
        console.error('Failed to delete', err);
      }
    });
  }
}
