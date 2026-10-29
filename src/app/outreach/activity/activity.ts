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
  Observable,
} from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardCalendarComponent } from '@/shared/components/calendar/calendar.component';
import { OutreachPageHeaderComponent } from '@/shared/components/page-header';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  ZardTableLoaderComponent,
} from '@/shared/components/table';
import { calculatePaginationIndices } from '@/shared/models';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardPopoverComponent, ZardPopoverDirective } from '@/shared/components/popover';
import { UserProfileService } from '../../core/services/user-profile.service';
import { OutreachService } from '../outreach.service';
import { ZardDialogService } from '@/shared/components/dialog';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';

export interface ActivityReportsVm {
  items: any[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
}

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
    ZardPopoverComponent,
    ZardPopoverDirective,
    LottieComponent,
    // RouterLink,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    ZardTableLoaderComponent,
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
  readonly screeningFilterOptions: ZardComboboxOption[] = [
    { value: 'ALL', label: 'Screening: All' },
    { value: 'YES', label: 'Screening: Yes' },
    { value: 'NO', label: 'Screening: No' },
  ];
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
    reportedBy: true,
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
    { key: 'reportedBy', label: 'Reported By' },
  ];

  showColumnSelector = false;

  // ── Date filter state ────────────────────────────────────────────────────
  filterDateRange: Date[] | null = null;
  tempFilterDateRange: Date[] | null = null;
  readonly dateFilter$ = new BehaviorSubject<{ startDate?: string; endDate?: string } | null>(null);

  // ── Loading indicator for pagination ─────────────────────────────────────
  readonly isPageLoading$ = new BehaviorSubject<boolean>(false);

  // ── Reactive streams ──────────────────────────────────────────────────────
  private readonly search$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    debounceTime(300),
    distinctUntilChanged(),
    map((value) => {
      this.page$.next(1);
      return (value || '').trim();
    }),
  );

  vm$: Observable<ActivityReportsVm> = combineLatest([
    this.refresh$.pipe(startWith(undefined)),
    this.page$.asObservable(),
    this.search$,
    this.screeningFilter$.asObservable(),
    this.dateFilter$.asObservable(),
    this.sortCol$.asObservable(),
    this.sortDir$.asObservable(),
  ]).pipe(
    switchMap(([_, page, search, screeningFilter, dateFilter, sortCol, sortDir]) => {
      this.isPageLoading$.next(true);
      const params: any = {
        page,
        limit: this.pageSize,
        screening: screeningFilter,
        sortBy: sortCol || 'createdAt',
        sortDir: sortDir || 'desc',
      };
      if (search) params.search = search;
      if (dateFilter?.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter?.endDate) params.endDate = dateFilter.endDate;

      return this.outreachService.getMyReports(params).pipe(
        map((res: any) => {
          this.isPageLoading$.next(false);
          this.isLoading = false;

          if (res && res.data && res.meta) {
            const data = Array.isArray(res.data) ? res.data : [];
            const meta = res.meta;
            const total = meta.total ?? data.length;
            const pageCount = meta.totalPages ?? Math.max(1, Math.ceil(total / this.pageSize));
            const safePage = meta.page ?? page;
            const { startIndex, endIndex } = calculatePaginationIndices(safePage, meta.limit ?? this.pageSize, total);

            this.lastPage = safePage;
            this.lastPageCount = pageCount;

            return {
              items: data,
              total,
              page: safePage,
              pageCount,
              pageSize: meta.limit ?? this.pageSize,
              startIndex,
              endIndex,
            };
          }

          // Fallback if plain array
          const reports = Array.isArray(res) ? res : [];
          let filteredReports = reports.filter((report) => {
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

            return searchableText.includes(search.toLowerCase());
          });

          let sortedReports = [...filteredReports];
          if (sortCol) {
            sortedReports.sort((a: any, b: any) => {
              let aVal: any = a[sortCol];
              let bVal: any = b[sortCol];
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

  viewDetails(report: any): void {
    const targetId = report.beneficiary?.id || report.child?.beneficiaryId;
    if (targetId) {
      this.router.navigate(['/outreach/beneficiary', targetId]);
    }
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

  onScreeningFilterChange(value: 'ALL' | 'YES' | 'NO' | string): void {
    const val = (value as 'ALL' | 'YES' | 'NO') || 'ALL';
    this.screeningFilter = val;
    this.page$.next(1);
    this.screeningFilter$.next(val);
  }

  currentScreeningPopover: any = null;

  onOpenScreeningPopover(popover?: any): void {
    this.currentScreeningPopover = popover;
  }

  selectScreeningFilter(val: 'ALL' | 'YES' | 'NO', popover?: any): void {
    const target = popover || this.currentScreeningPopover;
    this.onScreeningFilterChange(val);
    if (target && typeof target.hide === 'function') {
      target.hide();
    }
    this.currentScreeningPopover = null;
  }

  get isScreeningFilterActive(): boolean {
    return this.screeningFilter !== 'ALL';
  }

  currentDatePopover: any = null;

  onOpenDatePopover(popover?: any): void {
    this.currentDatePopover = popover;
    this.tempFilterDateRange = this.filterDateRange ? [...this.filterDateRange] : null;
  }

  applyDateFilter(popover?: any, secondaryPopover?: any): void {
    const target = popover || this.currentDatePopover;
    const range = (this.tempFilterDateRange || []).filter(Boolean) as Date[];
    this.filterDateRange = range.length > 0 ? range : null;

    if (this.filterDateRange && this.filterDateRange.length > 0) {
      const start = this.filterDateRange[0];
      const end = this.filterDateRange[1] ?? this.filterDateRange[0];
      const startDate = start.toISOString();
      const endDate = end.toISOString();
      this.page$.next(1);
      this.dateFilter$.next({ startDate, endDate });
    } else {
      this.clearDateFilter(target, secondaryPopover);
      return;
    }

    if (target && typeof target.hide === 'function') {
      target.hide();
    }
    if (secondaryPopover && typeof secondaryPopover.hide === 'function') {
      secondaryPopover.hide();
    }
    this.currentDatePopover = null;
  }

  clearDateFilter(popover?: any, secondaryPopover?: any): void {
    const target = popover || this.currentDatePopover;
    this.filterDateRange = null;
    this.tempFilterDateRange = null;
    this.page$.next(1);
    this.dateFilter$.next(null);

    if (target && typeof target.hide === 'function') {
      target.hide();
    }
    if (secondaryPopover && typeof secondaryPopover.hide === 'function') {
      secondaryPopover.hide();
    }
    this.currentDatePopover = null;
  }

  get isDateFilterActive(): boolean {
    return !!(this.filterDateRange && this.filterDateRange.length > 0);
  }

  get dateFilterLabel(): string {
    if (!this.filterDateRange || this.filterDateRange.length === 0) {
      return 'Date Range';
    }
    const start = this.filterDateRange[0];
    const end = this.filterDateRange[1] ?? start;
    const format = (d: Date) => d.toLocaleDateString('en-GB');
    if (start.getTime() === end.getTime()) {
      return format(start);
    }
    return `${format(start)} - ${format(end)}`;
  }

  setScreeningFilter(filter: 'ALL' | 'YES' | 'NO'): void {
    this.screeningFilter = filter;
    this.page$.next(1);
    this.screeningFilter$.next(filter);
  }

  get screeningFilterLabel(): string {
    switch (this.screeningFilter) {
      case 'YES':
        return 'Screened (Yes)';
      case 'NO':
        return 'Not Screened (No)';
      default:
        return 'Screening: All';
    }
  }

  get screeningMobileFilterLabel(): string {
    switch (this.screeningFilter) {
      case 'YES':
        return 'Screened';
      case 'NO':
        return 'Not Screened';
      default:
        return 'Screening';
    }
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
    return '-';
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
    const search = (this.searchControl.value || '').trim();
    const screening = this.screeningFilter$.value;
    const params: any = { all: 'true', screening };
    if (search) params.search = search;

    const res = await firstValueFrom(this.outreachService.getMyReports(params));
    const reports = Array.isArray(res) ? res : (res?.data || []);

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
    const search = (this.searchControl.value || '').trim();
    const screening = this.screeningFilter$.value;
    const dateFilter = this.dateFilter$.value;
    const params: any = { all: 'true', screening };
    if (search) params.search = search;
    if (dateFilter?.startDate) params.startDate = dateFilter.startDate;
    if (dateFilter?.endDate) params.endDate = dateFilter.endDate;

    const res = await firstValueFrom(this.outreachService.getMyReports(params));
    const reports = Array.isArray(res) ? res : (res?.data || []);

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

      row['High Risk Pregnant'] = (reportData?.pregnancyStatus === 'Currently Pregnant' || reportData?.pregnancyStatus === 'Yes') ? (reportData?.highRiskPregnant ?? 'No') : '-';

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

  currentExportPopover: any = null;

  onOpenExportPopover(popover?: any): void {
    this.currentExportPopover = popover;
    this.exportMode = 'RANGE';
    this.exportDateRange = null;
  }

  closeExportPopover(popover?: any): void {
    const target = popover || this.currentExportPopover;
    if (target && typeof target.hide === 'function') {
      target.hide();
    }
    this.currentExportPopover = null;
  }

  confirmExport(popover?: any): void {
    this.closeExportPopover(popover);
    this.exportToExcel();
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
