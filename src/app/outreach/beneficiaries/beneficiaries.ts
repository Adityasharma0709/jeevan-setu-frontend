import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  Subscription,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  Subject,
  switchMap,
  BehaviorSubject,
  shareReplay,
  firstValueFrom,
} from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '@/core/services/auth';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardDialogRef } from '@/shared/components/dialog/dialog-ref';
import { ZardDialogService } from '@/shared/components/dialog/dialog.service';
import { ZardDialogModule } from '@/shared/components/dialog/dialog.component';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective } from '@/shared/components/input';
import {
  ZardTableBodyComponent,
  ZardTableCellComponent,
  ZardTableComponent,
  ZardTableHeadComponent,
  ZardTableHeaderComponent,
  ZardTableRowComponent,
} from '@/shared/components/table';

import { Beneficiary, OutreachService } from '../outreach.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-beneficiaries',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardDialogModule,
    ZardIconComponent,
    ZardInputDirective,
    // ZardTableBodyComponent,
    // ZardTableCellComponent,
    // ZardTableComponent,
    // ZardTableHeadComponent,
    // ZardTableHeaderComponent,
    // ZardTableRowComponent,
    LottieComponent,
  ],
  templateUrl: './beneficiaries.html',
})
export class Beneficiaries implements OnInit, OnDestroy {
  private outreachService = inject(OutreachService);
  private dialog = inject(ZardDialogService);
  private authService = inject(AuthService);
  private router = inject(Router);

  private refresh$ = new Subject<void>();
  private subs = new Subscription();

  selectedColumns = {
  uid: true,
  name: true,
  gender:true,
  mobile: true,
  project: true,
  location: true,
};

mobileViewMode: 'quickAccess' | 'table' = 'quickAccess';

  dialogRef!: ZardDialogRef<any>;

  // ── Animations ────────────────────────────────────────────────────────────
  options: AnimationOptions = { path: '/loading.json' };

  // ── Pagination & Search ──────────────────────────────────────────────────
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  searchControl = new FormControl('');
  private lastPage = 1;
  private lastPageCount = 1;

  // ── Reactive streams ──────────────────────────────────────────────────────

  private readonly rawBeneficiaries$ = combineLatest([
    this.refresh$.pipe(startWith(void 0)),
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(250),
      distinctUntilChanged(),
      map((s) => {
        this.page$.next(1); // Reset to page 1 on search
        return (s || '').trim();
      }),
    ),
  ]).pipe(
    switchMap(([_, search]) => this.outreachService.getBeneficiaries(search)),
    map((rows) => (Array.isArray(rows) ? rows : [])),
    shareReplay(1),
  );

  vm$ = combineLatest([this.rawBeneficiaries$, this.page$.asObservable()]).pipe(
    map(([beneficiaries, page]) => {
      const total = beneficiaries.length;
      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: beneficiaries.slice(startIndex, startIndex + this.pageSize),
        total,
        page: safePage,
        pageCount,
        pageSize: this.pageSize,
        startIndex,
        endIndex: Math.min(startIndex + this.pageSize, total),
      };
    }),
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  navigateToCreate(): void {
    this.router.navigate(['/outreach/beneficiaries/create']);
  }

  viewDetails(beneficiary: Beneficiary): void {
    this.router.navigate(['/outreach/beneficiary', beneficiary.id], { state: { beneficiary } });
  }

  // ── Pagination Helpers ───────────────────────────────────────────────────

  nextPage(): void {
    if (this.lastPage < this.lastPageCount) {
      this.page$.next(this.lastPage + 1);
    }
  }

  prevPage(): void {
    if (this.lastPage > 1) {
      this.page$.next(this.lastPage - 1);
    }
  }

  trackById(_: number, item: Beneficiary): number {
    return item.id;
  }
  //===================Quick Access===========================
    setMobileViewMode(mode: 'quickAccess' | 'table'): void {
    this.mobileViewMode = mode;
  }


  //====================Excel=================================
  async exportToExcel(): Promise<void> {

  const vm = await firstValueFrom(this.vm$);

  const data = vm.items.map((beneficiary: any, index: number) => {

    const row: any = {};

    if (this.selectedColumns.uid) {
      row['UID'] = beneficiary.uid;
    }

    if (this.selectedColumns.name) {
      row['Name'] = beneficiary.name;
    }

     if (this.selectedColumns.gender) {
      row['Gender'] = beneficiary.gender;
    }

    if (this.selectedColumns.mobile) {
      row['Mobile'] =
        beneficiary.mobileNumber || '-';
    }

    if (this.selectedColumns.project) {
      row['Project'] =
        beneficiary.project?.name || '-';
    }

    if (this.selectedColumns.location) {
      row['Location'] =
        beneficiary.village ||
        beneficiary.location?.village ||
        '-';
    }

    return row;
  });

  const worksheet: XLSX.WorkSheet =
    XLSX.utils.json_to_sheet(data);

  const workbook: XLSX.WorkBook = {
    Sheets: { Beneficiaries: worksheet },
    SheetNames: ['Beneficiaries'],
  };

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });

  const blob = new Blob(
    [excelBuffer],
    {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    }
  );

  saveAs(blob, 'beneficiaries.xlsx');
}
}
