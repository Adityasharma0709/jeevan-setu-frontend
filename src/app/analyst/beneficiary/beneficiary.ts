import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, HostListener, TemplateRef, viewChild } from '@angular/core';
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
  of,
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
import { ZardCalendarComponent } from '@/shared/components/calendar/calendar.component';
import { ZardComboboxComponent } from '@/shared/components/combobox';
import { OutreachPageHeaderComponent } from '../../outreach/shared/page-header/page-header';
import {
  ZardTableBodyComponent,
  ZardTableCellComponent,
  ZardTableComponent,
  ZardTableHeadComponent,
  ZardTableHeaderComponent,
  ZardTableRowComponent,
} from '@/shared/components/table';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';

import { AnalystService } from '../analyst.service';
import { Router } from '@angular/router';
import { Beneficiary } from '../../outreach/outreach.service';

@Component({
  selector: 'app-analyst-beneficiary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardDialogModule,
    ZardIconComponent,
    ZardInputDirective,
    ZardCalendarComponent,
    ZardComboboxComponent,
    ZardTableBodyComponent,
    ZardTableCellComponent,
    ZardTableComponent,
    ZardTableHeadComponent,
    ZardTableHeaderComponent,
    ZardTableRowComponent,
    OutreachPageHeaderComponent,
    LottieComponent,
    ZardPaginationComponent,
  ],
  templateUrl: './beneficiary.html',
})
export class AnalystBeneficiary implements OnInit, OnDestroy {
  private analystService = inject(AnalystService);
  private dialog = inject(ZardDialogService);
  private router = inject(Router);

  private refresh$ = new Subject<void>();
  private subs = new Subscription();

  isManager = true; // Use to hide edit/create actions

  selectedColumns: { [key: string]: boolean } = {
    uid: true,
    name: true,
    beneficiaryType: true,
    age: true,
    gender: true,
    mobile: true,
    guardianName: true,
    maritalStatus: true,
    dateOfMarriage: true,
    womanAgeAtMarriage: true,
    husbandAgeAtMarriage: true,
    qualification: true,
    religion: true,
    caste: true,
    monthlyIncome: true,
    economicStatus: true,
    primaryIncomeSource: true,
    employmentStatus: true,
    project: true,
    location: true,
    createdAt: true,
  };

  columnList = [
    { key: 'uid', label: 'Beneficiary ID' },
    { key: 'name', label: 'Name' },
    { key: 'beneficiaryType', label: 'Type' },
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'guardianName', label: 'Guardian Name' },
    { key: 'maritalStatus', label: 'Marital Status' },
    { key: 'dateOfMarriage', label: 'Marriage Date' },
    { key: 'womanAgeAtMarriage', label: 'Woman Age at Marriage' },
    { key: 'husbandAgeAtMarriage', label: 'Husband Age at Marriage' },
    { key: 'qualification', label: 'Qualification' },
    { key: 'religion', label: 'Religion' },
    { key: 'caste', label: 'Caste' },
    { key: 'monthlyIncome', label: 'Monthly Income' },
    { key: 'economicStatus', label: 'Economic Status' },
    { key: 'primaryIncomeSource', label: 'Income Source' },
    { key: 'employmentStatus', label: 'Employment Status' },
    { key: 'project', label: 'Project' },
    { key: 'location', label: 'Location' },
    { key: 'createdAt', label: 'Registered Date' },
  ];

  showColumnSelector = false;

  mobileViewMode: 'quickAccess' | 'table' = 'quickAccess';

  dialogRef!: ZardDialogRef<any>;
  exportDateRange: Date[] | null = null;
  exportMode: 'ALL' | 'RANGE' = 'RANGE';
  exportOptions = [
    {
      label: 'Date Range',
      value: 'RANGE',
    },
    {
      label: 'All Records',
      value: 'ALL',
    },
  ];

  options: AnimationOptions = { path: '/loading.json' };

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  searchControl = new FormControl('');
  private lastPage = 1;
  private lastPageCount = 1;

  readonly sortCol$ = new BehaviorSubject<string | null>(null);
  readonly sortDir$ = new BehaviorSubject<'asc' | 'desc'>('asc');
  readonly exportDialog = viewChild.required<TemplateRef<any>>('exportDialog');

  private readonly rawBeneficiaries$ = this.refresh$.pipe(
    startWith(void 0),
    switchMap(() => this.analystService.getBeneficiaries()),
    map((rows) => (Array.isArray(rows) ? rows : [])),
    shareReplay(1),
  );

  private readonly search$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    debounceTime(250),
    distinctUntilChanged(),
    map((s) => {
      this.page$.next(1);
      return (s || '').trim().toLowerCase();
    }),
  );

  vm$ = combineLatest([
    this.rawBeneficiaries$,
    this.page$.asObservable(),
    this.sortCol$.asObservable(),
    this.sortDir$.asObservable(),
    this.search$,
  ]).pipe(
    map(([beneficiaries, page, sortCol, sortDir, search]) => {
      let items = [...beneficiaries];

      if (search) {
        items = items.filter((b) =>
          (b.name && b.name.toLowerCase().includes(search)) ||
          (b.uid && b.uid.toLowerCase().includes(search)) ||
          (b.mobileNumber && b.mobileNumber.toLowerCase().includes(search)) ||
          (b.village && b.village.toLowerCase().includes(search)) ||
          (b.location?.village && b.location.village.toLowerCase().includes(search)) ||
          (b.project?.name && b.project.name.toLowerCase().includes(search))
        );
      }

      if (sortCol) {
        items.sort((a: any, b: any) => {
          let aVal: any = a[sortCol];
          let bVal: any = b[sortCol];

          if (sortCol === 'project') {
            aVal = a.project?.name || '';
            bVal = b.project?.name || '';
          } else if (sortCol === 'location') {
            aVal = a.village || a.location?.village || '';
            bVal = b.village || b.location?.village || '';
          } else if (sortCol === 'age') {
            aVal = a.dateOfBirth ? new Date(a.dateOfBirth).getTime() : 0;
            bVal = b.dateOfBirth ? new Date(b.dateOfBirth).getTime() : 0;
          } else if (sortCol === 'beneficiaryType') {
            const hasPriorityA = !!(a.guardianName || a.qualification || a.religion || a.caste);
            const hasPriorityB = !!(b.guardianName || b.qualification || b.religion || b.caste);
            aVal = hasPriorityA ? 'Priority' : 'General';
            bVal = hasPriorityB ? 'Priority' : 'General';
          } else if (sortCol === 'monthlyIncome') {
            aVal = Number(a.monthlyIncome) || 0;
            bVal = Number(b.monthlyIncome) || 0;
          } else if (sortCol === 'dateOfBirth' || sortCol === 'dateOfMarriage' || sortCol === 'createdAt') {
            aVal = a[sortCol] ? new Date(a[sortCol]).getTime() : 0;
            bVal = b[sortCol] ? new Date(b[sortCol]).getTime() : 0;
          } else {
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
          }

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: items.slice(startIndex, startIndex + this.pageSize),
        total,
        page: safePage,
        pageCount,
        pageSize: this.pageSize,
        startIndex,
        endIndex: Math.min(startIndex + this.pageSize, total),
      };
    }),
  );

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  sortBy(col: string) {
    const current = this.sortCol$.value;
    const dir = this.sortDir$.value;
    if (current === col) {
      if (dir === 'asc') this.sortDir$.next('desc');
      else { this.sortCol$.next(null); this.sortDir$.next('asc'); }
    } else {
      this.sortCol$.next(col);
      this.sortDir$.next('asc');
    }
  }

  navigateToCreate(): void {}

  viewDetails(beneficiary: any): void {
    this.router.navigate(['/analyst/beneficiary', beneficiary.id], { state: { beneficiary } });
  }

  editRecord(beneficiary: any): void {}

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
  }

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

  trackById(_: number, item: any): number {
    return item.id;
  }

  setMobileViewMode(mode: 'quickAccess' | 'table'): void {
    this.mobileViewMode = mode;
  }

  toggleColumnSelectorDropdown() {
    this.showColumnSelector = !this.showColumnSelector;
  }

  getColspan(): number {
    let count = 1;
    for (const key of Object.keys(this.selectedColumns)) {
      if (this.selectedColumns[key]) {
        count++;
      }
    }
    return count;
  }

  getAge(dateOfBirth: string | Date | null | undefined): string | number {
    if (!dateOfBirth) return '-';
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : '-';
  }

  getBeneficiaryType(b: any): string {
    const hasPriorityData = !!(b.guardianName || b.qualification || b.religion || b.caste);
    return hasPriorityData ? 'Priority' : 'General';
  }

  private toDateTimestamp(value: any): number | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      const time = value.getTime();
      return Number.isNaN(time) ? null : time;
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }

    const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }

    const parsed = new Date(text);
    const time = parsed.getTime();
    return Number.isNaN(time) ? null : time;
  }

  private filterBeneficiariesByDateRange(beneficiaries: any[]): any[] {
    const range = (this.exportDateRange || []).filter(Boolean) as Date[];

    if (range.length === 0) {
      return beneficiaries;
    }

    const startDate = range[0];
    const endDate = range[1] ?? range[0];
    const startOfStartDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endOfStartDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    const startOfEndDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    const endOfEndDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
    const lowerBound = Math.min(startOfStartDay, startOfEndDay);
    const upperBound = Math.max(endOfStartDay, endOfEndDay);

    return beneficiaries.filter((beneficiary) => {
      const createdAtTimestamp = this.toDateTimestamp(beneficiary?.createdAt);
      if (createdAtTimestamp === null) {
        return false;
      }

      return createdAtTimestamp >= lowerBound && createdAtTimestamp <= upperBound;
    });
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative.inline-block.text-left')) {
      this.showColumnSelector = false;
    }
  }

  async exportToExcel(): Promise<void> {
    const beneficiaries = await firstValueFrom(this.rawBeneficiaries$);

    let exportBeneficiaries: any[] = [];

    switch (this.exportMode) {
      case 'ALL':
        exportBeneficiaries = beneficiaries;
        break;

      case 'RANGE':
        exportBeneficiaries = this.filterBeneficiariesByDateRange(beneficiaries);
        break;

      default:
        exportBeneficiaries = beneficiaries;
    }

    const data = exportBeneficiaries.map((beneficiary: any) => {
      const row: any = {};

      if (this.selectedColumns['uid']) row['Beneficiary ID'] = beneficiary.uid || '-';
      if (this.selectedColumns['name']) row['Name'] = beneficiary.name || '-';
      if (this.selectedColumns['beneficiaryType']) row['Type'] = this.getBeneficiaryType(beneficiary);
      if (this.selectedColumns['age']) row['Age'] = this.getAge(beneficiary.dateOfBirth);
      if (this.selectedColumns['gender']) row['Gender'] = beneficiary.gender || '-';
      if (this.selectedColumns['mobile']) row['Mobile'] = beneficiary.mobileNumber || '-';
      if (this.selectedColumns['guardianName']) row['Guardian Name'] = beneficiary.guardianName || '-';
      if (this.selectedColumns['maritalStatus']) row['Marital Status'] = beneficiary.maritalStatus || 'Single';
      if (this.selectedColumns['dateOfMarriage']) {
        row['Marriage Date'] = beneficiary.dateOfMarriage ? new Date(beneficiary.dateOfMarriage).toLocaleDateString('en-GB') : '-';
      }
      if (this.selectedColumns['womanAgeAtMarriage']) row['Woman Age at Marriage'] = beneficiary.womanAgeAtMarriage || '-';
      if (this.selectedColumns['husbandAgeAtMarriage']) row['Husband Age at Marriage'] = beneficiary.husbandAgeAtMarriage || '-';
      if (this.selectedColumns['qualification']) row['Qualification'] = beneficiary.qualification || '-';
      if (this.selectedColumns['religion']) row['Religion'] = beneficiary.religion || '-';
      if (this.selectedColumns['caste']) row['Caste'] = beneficiary.caste || '-';
      if (this.selectedColumns['monthlyIncome']) row['Monthly Income'] = beneficiary.monthlyIncome || 0;
      if (this.selectedColumns['economicStatus']) row['Economic Status'] = beneficiary.economicStatus || '-';
      if (this.selectedColumns['primaryIncomeSource']) row['Income Source'] = beneficiary.primaryIncomeSource || '-';
      if (this.selectedColumns['employmentStatus']) row['Employment Status'] = beneficiary.employmentStatus || '-';
      if (this.selectedColumns['project']) row['Project'] = beneficiary.project?.name || '-';
      if (this.selectedColumns['location']) {
        row['Location'] = beneficiary.village || beneficiary.location?.village || '-';
      }
      if (this.selectedColumns['createdAt']) {
        row['Registered Date'] = beneficiary.createdAt ? new Date(beneficiary.createdAt).toLocaleDateString('en-GB') : '-';
      }

      return row;
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

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
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
      }
    );

    saveAs(blob, 'beneficiaries.xlsx');
  }

  openExportDialog(): void {
    this.exportMode = 'RANGE';
    this.exportDateRange = null;

    this.dialog.create({
      zTitle: 'Export Beneficiaries',
      zContent: this.exportDialog(),
      zOkText: 'Export',
      zCancelText: null,
      zOnOk: () => {
        this.exportToExcel();
      },
    });
  }
}
