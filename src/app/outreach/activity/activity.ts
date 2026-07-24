import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, TemplateRef, viewChild } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  startWith,
  switchMap,
  map,
  shareReplay,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
} from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardCalendarComponent } from '@/shared/components/calendar/calendar.component';
import { OutreachPageHeaderComponent } from '../shared/page-header/page-header';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { UserProfileService } from '../../core/services/user-profile.service';
import { OutreachService } from '../outreach.service';
import { ZardDialogService } from '@/shared/components/dialog';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardIconComponent,
    ZardCalendarComponent,
    LottieComponent,
    // RouterLink,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    OutreachPageHeaderComponent,
    ZardComboboxComponent,
    ZardPaginationComponent,
  ],
  templateUrl: './activity.html',
})
export class Activity {
  private outreachService = inject(OutreachService);
  private router = inject(Router);
  private userProfile = inject(UserProfileService);
  private dialog = inject(ZardDialogService);

  options: AnimationOptions = { path: '/loading.json' };
  profile$ = this.userProfile.profile$;
  searchControl = new FormControl('');

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly screeningFilter$ = new BehaviorSubject<'ALL' | 'YES' | 'NO'>('ALL');
  private lastPage = 1;
  private lastPageCount = 1;

  // date-range export choice
  exportDateRange: Date[] | null = null;

  // Sorting
  readonly sortCol$ = new BehaviorSubject<string | null>(null);
  readonly sortDir$ = new BehaviorSubject<'asc' | 'desc'>('asc');
  readonly exportDialog = viewChild.required<TemplateRef<any>>('exportDialog');
  isLoading = true;
  expandedReportId: number | null = null;
  screeningFilter: 'ALL' | 'YES' | 'NO' = 'ALL';
  mobileViewMode: 'quickAccess' | 'table' = 'quickAccess';
  exportMode: 'ALL' | 'RANGE' = 'RANGE'; //export choice given to the user

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

  selectedColumns: { [key: string]: boolean } = {
    index: true,
    beneficiaryId: true,
    beneficiaryName: true,
    group: true,
    activity: true,
    session: true,
    screening: true,
    date: true,
    details: true,
  };
  columnList = [
    { key: 'beneficiaryId', label: 'Beneficiary ID' },
    { key: 'beneficiaryName', label: 'Beneficiary Name' },
    { key: 'group', label: 'Group' },
    { key: 'activity', label: 'Activity' },
    { key: 'session', label: 'Session' },
    { key: 'screening', label: 'Screening' },
    { key: 'date', label: 'Date' },
    { key: 'details', label: 'Details' },
  ];

  showColumnSelector = false;

  reports$ = combineLatest([
    this.refresh$.pipe(startWith(undefined)),

    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      map((value) => {
        this.page$.next(1);
        return (value || '').trim().toLowerCase();
      }),
    ),

    this.screeningFilter$.asObservable(),
  ]).pipe(
    switchMap(([_, search, screeningFilter]) => {
      this.isLoading = true;

      return this.outreachService.getMyReports().pipe(
        map((reports) => {
          const filteredReports = reports.filter((report) => {
            const screening = String(report?.reportData?.screening || 'No').toUpperCase();

            const passesScreening = screeningFilter === 'ALL' || screening === screeningFilter;

            if (!passesScreening) return false;

            if (!search) return true;

            const searchableText = [
              report.child?.name,
              report.beneficiary?.name,
              report.child?.uid,
              report.beneficiary?.uid,
              report.activity?.name,
              report.session?.name,
              report.date,
              this.getScreeningSummary(report),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return searchableText.includes(search);
          });

          return filteredReports.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        }),
      );
    }),

    map((reports) => {
      this.isLoading = false;
      return reports;
    }),

    shareReplay(1),
  );

  vm$ = combineLatest([
    this.reports$,
    this.page$.asObservable(),
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      map((value) => (value || '').trim().toLowerCase()),
    ),
    this.screeningFilter$.asObservable(),
    this.sortCol$.asObservable(),
    this.sortDir$.asObservable(),
  ]).pipe(
    map(([reports, page, search, screeningFilter, sortCol, sortDir]) => {
      const filteredReports = reports.filter((report) => {
        const screening = String(report?.reportData?.screening || 'No').toUpperCase();

        const passesScreening = screeningFilter === 'ALL' || screening === screeningFilter;

        if (!passesScreening) return false;

        if (!search) return true;

        const searchableText = [
          report.child?.name,
          report.beneficiary?.name,
          report.child?.uid,
          report.beneficiary?.uid,
          report.activity?.name,
          report.session?.name,
          report.date,
          this.getScreeningSummary(report),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(search);
      });

      let sortedReports = [...filteredReports];
      if (sortCol) {
        sortedReports.sort((a: any, b: any) => {
          let aVal: any;
          let bVal: any;

          if (sortCol === 'beneficiaryId') {
            aVal = a.child?.uid || a.beneficiary?.uid || '';
            bVal = b.child?.uid || b.beneficiary?.uid || '';
          } else if (sortCol === 'beneficiaryName') {
            aVal = a.child?.name || a.beneficiary?.name || '';
            bVal = b.child?.name || b.beneficiary?.name || '';
          } else if (sortCol === 'group') {
            aVal = this.getReportGroup(a) || '';
            bVal = this.getReportGroup(b) || '';
          } else if (sortCol === 'activity') {
            aVal = a.activity?.name || '';
            bVal = b.activity?.name || '';
          } else if (sortCol === 'session') {
            aVal = a.session?.name || '';
            bVal = b.session?.name || '';
          } else if (sortCol === 'screening') {
            aVal = a.reportData?.screening || '';
            bVal = b.reportData?.screening || '';
          } else if (sortCol === 'date') {
            aVal = new Date(a.date).getTime() || 0;
            bVal = new Date(b.date).getTime() || 0;
          } else if (sortCol === 'details') {
            aVal = this.getScreeningSummary(a) || '';
            bVal = this.getScreeningSummary(b) || '';
          } else {
            aVal = a[sortCol];
            bVal = b[sortCol];
          }

          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const total = sortedReports.length;

      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));

      const safePage = Math.min(Math.max(1, page), pageCount);

      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: sortedReports.slice(startIndex, startIndex + this.pageSize),

        total,
        page: safePage,
        pageCount,
        pageSize: this.pageSize,
        startIndex,

        endIndex: Math.min(startIndex + this.pageSize, total),
      };
    }),
  );

  sortBy(col: string) {
    const current = this.sortCol$.value;
    const dir = this.sortDir$.value;
    if (current === col) {
      if (dir === 'asc') this.sortDir$.next('desc');
      else {
        this.sortCol$.next(null);
        this.sortDir$.next('asc');
      }
    } else {
      this.sortCol$.next(col);
      this.sortDir$.next('asc');
    }
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
  addReport() {
    this.router.navigate(['/outreach/report-activity']);
  }

  editReport(reportId: number) {
    this.router.navigate(['/outreach/report-activity'], { queryParams: { reportId } });
  }

  reload() {
    this.refresh$.next();
  }

  cycleScreeningFilter(): void {
    this.screeningFilter =
      this.screeningFilter === 'ALL' ? 'YES' : this.screeningFilter === 'YES' ? 'NO' : 'ALL';
    this.page$.next(1);
    this.screeningFilter$.next(this.screeningFilter);
  }

  get screeningFilterLabel(): string {
    return this.screeningFilter === 'ALL' ? 'All' : this.screeningFilter;
  }

  setMobileViewMode(mode: 'quickAccess' | 'table'): void {
    this.mobileViewMode = mode;
  }

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

  toggleExpand(reportId: number) {
    if (this.expandedReportId === reportId) {
      this.expandedReportId = null;
    } else {
      this.expandedReportId = reportId;
    }
  }

  getReportGroup(report: any): string {
    if (report?.reportData?.group) {
      return report.reportData.group;
    }
    // Fallback to database groups
    if (report?.child && report.child.childGroups && report.child.childGroups.length > 0) {
      return report.child.childGroups.map((g: any) => g.group?.name || g.name).join(', ');
    }
    if (report?.beneficiary?.groups && report.beneficiary.groups.length > 0 && !report.child) {
      return report.beneficiary.groups.map((g: any) => g.group?.name || g.name).join(', ');
    }
    return 'N/A';
  }

  getScreeningSummary(report: any): string {
    const data = report?.reportData;
    if (!data) return '—';

    const parts: string[] = [];

    // Screening Details
    if (data.screening === 'Yes' && data.screeningDetails) {
      const sd = data.screeningDetails;
      if (sd.height) parts.push(`H: ${sd.height}cm`);
      if (sd.weight) parts.push(`W: ${sd.weight}kg`);
      if (sd.bp) parts.push(`BP: ${sd.bp}`);
      if (sd.hb) parts.push(`Hb: ${sd.hb}`);
      if (sd.sugar) parts.push(`Sugar: ${sd.sugar}`);
      if (sd.pads) parts.push(`Pads: ${sd.pads}`);
    }

    // Pregnancy Status
    if (data.pregnancyStatus && data.pregnancyStatus !== 'No') {
      if (data.pregnancyStatus === 'Currently Pregnant' || data.pregnancyStatus === 'Yes') {
        parts.push('Pregnant');
        if (data.lmpDate) parts.push(`LMP: ${data.lmpDate}`);
        if (data.edd) parts.push(`EDD: ${data.edd}`);
      } else if (data.pregnancyStatus === 'Still Birth' || data.pregnancyStatus === 'Miscarriage/Aborted') {
        parts.push(data.pregnancyStatus);
        if (data.date) parts.push(`Date: ${data.date}`);
      } else if (data.pregnancyStatus === 'Baby Delivered') {
        parts.push('Baby Delivered');
        if (data.dod) parts.push(`DOD: ${data.dod}`);
        if (data.babyDetails?.name) parts.push(`Baby: ${data.babyDetails.name}`);
      }
    }

    // Nutrition Status
    if (data.samMamStatus) {
      parts.push(`Status: ${data.samMamStatus}`);
    }

    if (parts.length === 0) return data.screening || 'No';
    return parts.join('<br>');
  }
  //   const data = report?.reportData;

  //   if (!data) return '—';

  //   const parts: string[] = [];

  //   // Screening Details
  //   if (data.screening === 'Yes' && data.screeningDetails) {
  //     const sd = data.screeningDetails;

  //     if (sd.height) parts.push(`H: ${sd.height}cm`);
  //     if (sd.weight) parts.push(`W: ${sd.weight}kg`);
  //     if (sd.bp) parts.push(`BP: ${sd.bp}`);
  //     if (sd.hb) parts.push(`Hb: ${sd.hb}`);
  //     if (sd.sugar) parts.push(`Sugar: ${sd.sugar}`);

  //     // data.lmpDate ? parts.push(`LMP Date: ${data.lmpDate}`) : null;
  //     if (sd.pads) parts.push(`Pads: ${sd.pads}`);
  //   }

  //   // Pregnancy Status
  //   if (data.pregnancyStatus === 'Yes') {
  //     parts.push('Pregnant');
  //     data.lmpDate ? parts.push(`lmpDate:${data.lmpDate}`) : '';
  //   }

  //   // Nutrition Status
  //   if (data.samMamStatus) {
  //     parts.push(`Status: ${data.samMamStatus}`);
  //   }

  //   if (parts.length === 0) return data.screening || 'No';

  //   return parts.join('<br>');
  // }

  //==================================================//
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

  private filterReportsByDateRange(reports: any[]): any[] {
    const range = (this.exportDateRange || []).filter(Boolean) as Date[];

    if (range.length === 0) {
      return reports;
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

    return reports.filter((report) => {
      const reportTimestamp = this.toDateTimestamp(report?.date);
      if (reportTimestamp === null) {
        return false;
      }

      return reportTimestamp >= lowerBound && reportTimestamp <= upperBound;
    });
  }

  async getReportsForExport() {
    const reports = await firstValueFrom(this.reports$);

    switch (this.exportMode) {
      case 'ALL':
        return reports;

      case 'RANGE':
        return this.filterReportsByDateRange(reports);

      default:
        return reports;
    }
  }

  async exportToExcel(): Promise<void> {
    const reports = await firstValueFrom(this.reports$);

    let exportReports: any[] = [];

    switch (this.exportMode) {
      case 'ALL':
        exportReports = reports;
        break;

      case 'RANGE':
        exportReports = this.filterReportsByDateRange(reports);
        break;

      default:
        exportReports = reports;
    }

    const data = exportReports.map((report: any, index: number) => {
      const row: any = {};

      const reportData = report?.reportData || {};
      const screeningDetails = reportData?.screeningDetails || {};

      if (this.selectedColumns['index']) {
        row['#'] = index + 1;
      }

      if (this.selectedColumns['beneficiaryId']) {
        row['Beneficiary ID'] = report.child?.uid || report.beneficiary?.uid || '-';
      }

      if (this.selectedColumns['beneficiaryName']) {
        row['Beneficiary Name'] = report.child?.name || report.beneficiary?.name || 'Unknown';
      }

      if (this.selectedColumns['group']) {
        row['Group'] = this.getReportGroup(report);
      }

      if (this.selectedColumns['activity']) {
        row['Activity'] = report.activity?.name || '-';
      }

      if (this.selectedColumns['session']) {
        row['Session'] = report.session?.name || '-';
      }

      if (this.selectedColumns['screening']) {
        row['Screening'] = reportData?.screening || 'No';
      }

      row['Height (cm)'] = screeningDetails?.height ?? '-';

      row['Weight (kg)'] = screeningDetails?.weight ?? '-';

      row['Hb (g/dL)'] = screeningDetails?.hb ?? '-';

      row['BP'] = screeningDetails?.bp ?? '-';

      row['Sugar'] = screeningDetails?.sugar ?? '-';

      row['Cervical Cancer'] = screeningDetails?.cervicalCancer ?? '-';

      row['Breast Cancer'] = screeningDetails?.breastCancer ?? '-';

      row['Pads'] = screeningDetails?.pads ?? '-';

      row['Pregnancy Status'] = reportData?.pregnancyStatus ?? '-';

      row['LMP Date'] = reportData?.lmpDate ?? '-';

      row['EDD'] = reportData?.edd ?? '-';

      row['Pregnancy Event Date'] = (reportData?.pregnancyStatus === 'Still Birth' || reportData?.pregnancyStatus === 'Miscarriage/Aborted') ? (reportData?.date ?? '-') : '-';

      row['Date of Delivery'] = reportData?.dod ?? '-';

      row['Baby Name'] = reportData?.babyDetails?.name ?? '-';

      row['Baby Gender'] = reportData?.babyDetails?.gender ?? '-';

      row['SAM/MAM Status'] = reportData?.samMamStatus ?? '-';

      if (this.selectedColumns['date']) {
        row['Date'] = report.date || '-';
      }

      return row;
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);

    worksheet['!cols'] = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...data.map((row) => String(row[key] ?? '').length)) + 2,
    }));

    const workbook: XLSX.WorkBook = {
      Sheets: {
        Reports: worksheet,
      },
      SheetNames: ['Reports'],
    };

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    saveAs(blob, 'activity-reports.xlsx');
  }

  openExportDialog() {
    this.exportMode = 'RANGE';
    this.exportDateRange = null;

    this.dialog.create({
      zTitle: 'Export Reports',
      zContent: this.exportDialog(),
      zOkText: 'Export',
      zCancelText: null,
      zOnOk: () => {
        this.exportToExcel();
      },
    });
  }
  //==================================================//

  toggleColumnSelectorDropdown() {
    this.showColumnSelector = !this.showColumnSelector;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (!target.closest('.relative.inline-block.text-left')) {
      this.showColumnSelector = false;
    }
  }
}
