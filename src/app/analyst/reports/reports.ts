import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subscription,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardCalendarComponent } from '@/shared/components/calendar/calendar.component';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { ZardPopoverComponent, ZardPopoverDirective } from '@/shared/components/popover';
import { OutreachPageHeaderComponent } from '@/shared/components/page-header';
import {
  ZardTableBodyComponent,
  ZardTableCellComponent,
  ZardTableComponent,
  ZardTableHeadComponent,
  ZardTableHeaderComponent,
  ZardTableRowComponent,
  ZardTableLoaderComponent,
} from '@/shared/components/table';
import { ZardPaginationComponent } from '@/shared/components/pagination/pagination.component';
import { calculatePaginationIndices } from '@/shared/models';
import { AnalystService } from '../analyst.service';

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
  selector: 'app-analyst-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ZardButtonComponent,
    ZardIconComponent,
    ZardInputDirective,
    ZardCalendarComponent,
    ZardComboboxComponent,
    ZardPopoverComponent,
    ZardPopoverDirective,
    ZardTableBodyComponent,
    ZardTableCellComponent,
    ZardTableComponent,
    ZardTableHeadComponent,
    ZardTableHeaderComponent,
    ZardTableRowComponent,
    ZardTableLoaderComponent,
    ZardPaginationComponent,
    OutreachPageHeaderComponent,
    LottieComponent,
  ],
  templateUrl: './reports.html',
})
export class AnalystReports implements OnInit, OnDestroy {
  private analystService = inject(AnalystService);
  private router = inject(Router);
  private subs = new Subscription();

  options: AnimationOptions = { path: '/loading.json' };
  searchControl = new FormControl('');

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastPageCount = 1;

  // ── State & District Filter Controls ────────────────────────────────────
  stateControl = new FormControl<string>('ALL');
  districtControl = new FormControl<string>('ALL');
  stateOptions: ZardComboboxOption[] = [{ label: 'All States', value: 'ALL' }];
  districtOptions: ZardComboboxOption[] = [{ label: 'All Districts', value: 'ALL' }];
  private districtsByState: Record<string, string[]> = {};
  private allDistricts: string[] = [];

  // ── Screening Filter Popover State ──────────────────────────────────────
  screeningFilter: 'ALL' | 'YES' | 'NO' = 'ALL';
  private readonly screeningFilter$ = new BehaviorSubject<'ALL' | 'YES' | 'NO'>('ALL');
  currentScreeningPopover: any = null;

  // ── Date Filter Popover State ───────────────────────────────────────────
  filterDateRange: Date[] | null = null;
  tempFilterDateRange: Date[] | null = null;
  currentDatePopover: any = null;
  private readonly dateFilter$ = new BehaviorSubject<{ startDate?: string; endDate?: string } | null>(null);

  // ── Excel Export Popover State ──────────────────────────────────────────
  currentExportPopover: any = null;
  exportDateRange: Date[] | null = null;
  exportMode: 'ALL' | 'RANGE' = 'RANGE';
  exportOptions: ZardComboboxOption[] = [
    { label: 'Date Range', value: 'RANGE' },
    { label: 'All Records', value: 'ALL' },
  ];
  isExporting = false;

  // ── Sorting ─────────────────────────────────────────────────────────────
  readonly sortCol$ = new BehaviorSubject<string | null>('createdAt');
  readonly sortDir$ = new BehaviorSubject<'asc' | 'desc'>('desc');

  // ── Column Selector ─────────────────────────────────────────────────────
  showColumnSelector = false;

  selectedColumns: Record<string, boolean> = {
    index: true,
    beneficiaryId: true,
    beneficiaryName: true,
    state: true,
    district: true,
    block: true,
    village: true,
    school: false,
    awc: false,
    healthCenter: false,
    age: true,
    group: true,
    beneficiaryType: true,
    activity: true,
    session: true,
    sessionDate: true,
    screening: true,
    height: false,
    weight: false,
    hb: true,
    bp: true,
    sugar: false,
    cervicalCancer: false,
    breastCancer: false,
    pads: false,
    pregnancyStatus: true,
    lmpDate: false,
    edd: false,
    highRiskPregnant: true,
    deliveryDate: false,
    babyName: false,
    babyGender: false,
    babyDob: false,
    samMamStatus: false,
    reportedBy: true,
  };

  columnList = [
    { key: 'beneficiaryId', label: 'Beneficiary ID' },
    { key: 'beneficiaryName', label: 'Beneficiary Name' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'block', label: 'Block' },
    { key: 'village', label: 'Village' },
    { key: 'school', label: 'School' },
    { key: 'awc', label: 'AWC' },
    { key: 'healthCenter', label: 'Health Centre' },
    { key: 'age', label: 'Age' },
    { key: 'group', label: 'Group' },
    { key: 'beneficiaryType', label: 'Beneficiary Type' },
    { key: 'activity', label: 'Activity' },
    { key: 'session', label: 'Session' },
    { key: 'sessionDate', label: 'Session Date' },
    { key: 'screening', label: 'Screening' },
    { key: 'height', label: 'Height (cm)' },
    { key: 'weight', label: 'Weight (kg)' },
    { key: 'hb', label: 'Hb (g/dL)' },
    { key: 'bp', label: 'BP' },
    { key: 'sugar', label: 'Sugar' },
    { key: 'cervicalCancer', label: 'Cervical Cancer' },
    { key: 'breastCancer', label: 'Breast Cancer' },
    { key: 'pads', label: 'Pads' },
    { key: 'pregnancyStatus', label: 'Pregnancy Status' },
    { key: 'lmpDate', label: 'LMP Date' },
    { key: 'edd', label: 'EDD' },
    { key: 'highRiskPregnant', label: 'High Risk Pregnancy' },
    { key: 'deliveryDate', label: 'Date of Delivery' },
    { key: 'babyName', label: 'Baby Name' },
    { key: 'babyGender', label: 'Baby Gender' },
    { key: 'babyDob', label: 'Baby DOB' },
    { key: 'samMamStatus', label: 'SAM/MAM Status' },
    { key: 'reportedBy', label: 'Reported By' },
  ];

  mobileViewMode: 'quickAccess' | 'table' = 'quickAccess';

  // ── Loading indicator ───────────────────────────────────────────────────
  readonly isPageLoading$ = new BehaviorSubject<boolean>(false);

  // ── Reactive streams ────────────────────────────────────────────────────
  private readonly search$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    debounceTime(300),
    distinctUntilChanged(),
    map((value) => {
      this.page$.next(1);
      return (value || '').trim();
    }),
  );

  vm$!: Observable<ActivityReportsVm>;

  ngOnInit(): void {
    this.loadLocationFilters();
    this.setupCascadeStateDistrict();
    this.setupViewModel();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private loadLocationFilters(): void {
    this.subs.add(
      this.analystService.getReportLocations().subscribe((res) => {
        const states = res.states || [];
        this.districtsByState = res.districtsByState || {};
        this.allDistricts = res.allDistricts || [];

        this.stateOptions = [
          { label: 'All States', value: 'ALL' },
          ...states.map((s) => ({ label: s, value: s })),
        ];

        this.updateDistrictOptions(this.stateControl.value || 'ALL');
      })
    );
  }

  private setupCascadeStateDistrict(): void {
    this.subs.add(
      this.stateControl.valueChanges.subscribe((selectedState) => {
        this.updateDistrictOptions(selectedState || 'ALL');
        this.districtControl.setValue('ALL', { emitEvent: false });
        this.page$.next(1);
      })
    );
  }

  private updateDistrictOptions(stateVal: string): void {
    const list =
      stateVal && stateVal !== 'ALL'
        ? this.districtsByState[stateVal] || []
        : this.allDistricts;

    this.districtOptions = [
      { label: 'All Districts', value: 'ALL' },
      ...list.map((d) => ({ label: d, value: d })),
    ];
  }

  private setupViewModel(): void {
    const state$ = this.stateControl.valueChanges.pipe(
      startWith(this.stateControl.value),
      tap(() => this.page$.next(1))
    );

    const district$ = this.districtControl.valueChanges.pipe(
      startWith(this.districtControl.value),
      tap(() => this.page$.next(1))
    );

    this.vm$ = combineLatest([
      this.refresh$.pipe(startWith(undefined)),
      this.page$.asObservable(),
      this.search$,
      this.screeningFilter$.asObservable(),
      this.dateFilter$.asObservable(),
      state$,
      district$,
      this.sortCol$.asObservable(),
      this.sortDir$.asObservable(),
    ]).pipe(
      switchMap(([_, page, search, screeningFilter, dateFilter, state, district, sortCol, sortDir]) => {
        this.isPageLoading$.next(true);

        const params: any = {
          page,
          limit: this.pageSize,
          sortBy: sortCol || 'createdAt',
          sortDir: sortDir || 'desc',
        };

        if (state && state !== 'ALL') params.state = state;
        if (district && district !== 'ALL') params.district = district;
        if (screeningFilter && screeningFilter !== 'ALL') params.screening = screeningFilter;
        if (search) params.search = search;
        if (dateFilter?.startDate) params.startDate = dateFilter.startDate;
        if (dateFilter?.endDate) params.endDate = dateFilter.endDate;

        return this.analystService.getReports(params).pipe(
          map((res: any) => {
            this.isPageLoading$.next(false);

            const data = Array.isArray(res?.data) ? res.data : [];
            const meta = res?.meta || {};
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
          }),
          tap({
            error: () => this.isPageLoading$.next(false),
          })
        );
      })
    );
  }

  // ── Sorting ─────────────────────────────────────────────────────────────
  sortBy(col: string): void {
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

  viewDetails(report: any): void {
    const targetId = report.beneficiaryDbId || report.beneficiaryId || report.id;
    if (targetId) {
      this.router.navigate(['/analyst/beneficiary', targetId]);
    }
  }

  // ── Screening Filter Popover Helpers ─────────────────────────────────────
  onOpenScreeningPopover(popover?: any): void {
    this.currentScreeningPopover = popover;
  }

  selectScreeningFilter(val: 'ALL' | 'YES' | 'NO', popover?: any): void {
    const target = popover || this.currentScreeningPopover;
    this.screeningFilter = val;
    this.page$.next(1);
    this.screeningFilter$.next(val);
    if (target && typeof target.hide === 'function') {
      target.hide();
    }
    this.currentScreeningPopover = null;
  }

  get isScreeningFilterActive(): boolean {
    return this.screeningFilter !== 'ALL';
  }

  get screeningFilterLabel(): string {
    switch (this.screeningFilter) {
      case 'YES':
        return 'Screened (Yes)';
      case 'NO':
        return 'Not Screened (No)';
      default:
        return 'Screening';
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

  // ── Date Filter Popover Helpers ──────────────────────────────────────────
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

  // ── Column Selector Dropdown ────────────────────────────────────────────
  toggleColumnSelectorDropdown(): void {
    this.showColumnSelector = !this.showColumnSelector;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.column-selector-container') && this.showColumnSelector) {
      this.showColumnSelector = false;
    }
  }

  // ── Excel Export Popover Helpers ─────────────────────────────────────────
  onOpenExportPopover(popover?: any): void {
    this.currentExportPopover = popover;
    this.exportDateRange = null;
    this.exportMode = 'RANGE';
  }

  closeExportPopover(): void {
    if (this.currentExportPopover && typeof this.currentExportPopover.hide === 'function') {
      this.currentExportPopover.hide();
    }
    this.currentExportPopover = null;
  }

  async confirmExport(): Promise<void> {
    this.isExporting = true;
    try {
      const search = (this.searchControl.value || '').trim();
      const screening = this.screeningFilter$.value;
      const state = this.stateControl.value;
      const district = this.districtControl.value;

      const params: any = { all: 'true' };
      if (screening && screening !== 'ALL') params.screening = screening;
      if (state && state !== 'ALL') params.state = state;
      if (district && district !== 'ALL') params.district = district;
      if (search) params.search = search;

      if (this.exportMode === 'RANGE' && this.exportDateRange && this.exportDateRange.length > 0) {
        const start = this.exportDateRange[0];
        const end = this.exportDateRange[1] ?? start;
        params.startDate = start.toISOString();
        params.endDate = end.toISOString();
      }

      const res = await firstValueFrom(this.analystService.getReports(params));
      const reports = Array.isArray(res) ? res : (res?.data || []);

      const data = reports.map((r: any, index: number) => {
        const row: any = {};
        if (this.selectedColumns['index']) row['#'] = index + 1;
        if (this.selectedColumns['state']) row['State'] = r.state || '-';
        if (this.selectedColumns['district']) row['District'] = r.district || '-';
        if (this.selectedColumns['block']) row['Block'] = r.block || '-';
        if (this.selectedColumns['village']) row['Village'] = r.village || '-';
        if (this.selectedColumns['school']) row['School'] = r.school || '-';
        if (this.selectedColumns['awc']) row['AWC'] = r.awc || '-';
        if (this.selectedColumns['healthCenter']) row['Health Centre'] = r.healthCenter || '-';
        if (this.selectedColumns['beneficiaryId']) row['Beneficiary ID'] = r.beneficiaryId || '-';
        if (this.selectedColumns['beneficiaryName']) row['Beneficiary Name'] = r.beneficiaryName || '-';
        if (this.selectedColumns['age']) row['Age'] = r.age || '-';
        if (this.selectedColumns['group']) row['Group'] = r.group || '-';
        if (this.selectedColumns['beneficiaryType']) row['Beneficiary Type'] = r.beneficiaryType || '-';
        if (this.selectedColumns['activity']) row['Activity'] = r.activity || '-';
        if (this.selectedColumns['session']) row['Session'] = r.session || '-';
        if (this.selectedColumns['sessionDate']) row['Session Date'] = r.sessionDate || '-';
        if (this.selectedColumns['screening']) row['Screening'] = r.screening || 'No';
        if (this.selectedColumns['height']) row['Height (cm)'] = r.height || '-';
        if (this.selectedColumns['weight']) row['Weight (kg)'] = r.weight || '-';
        if (this.selectedColumns['hb']) row['Hb (g/dL)'] = r.hb || '-';
        if (this.selectedColumns['bp']) row['BP'] = r.bp || '-';
        if (this.selectedColumns['sugar']) row['Sugar'] = r.sugar || '-';
        if (this.selectedColumns['cervicalCancer']) row['Cervical Cancer'] = r.cervicalCancer || '-';
        if (this.selectedColumns['breastCancer']) row['Breast Cancer'] = r.breastCancer || '-';
        if (this.selectedColumns['pads']) row['Pads'] = r.pads || '-';
        if (this.selectedColumns['pregnancyStatus']) row['Pregnancy Status'] = r.pregnancyStatus || '-';
        if (this.selectedColumns['lmpDate']) row['LMP Date'] = r.lmpDate || '-';
        if (this.selectedColumns['edd']) row['EDD'] = r.edd || '-';
        if (this.selectedColumns['highRiskPregnant']) row['High Risk Pregnancy'] = r.highRiskPregnant || '-';
        if (this.selectedColumns['deliveryDate']) row['Date of Delivery'] = r.deliveryDate || '-';
        if (this.selectedColumns['babyName']) row['Baby Name'] = r.babyName || '-';
        if (this.selectedColumns['babyGender']) row['Baby Gender'] = r.babyGender || '-';
        if (this.selectedColumns['babyDob']) row['Baby DOB'] = r.babyDob || '-';
        if (this.selectedColumns['samMamStatus']) row['SAM/MAM Status'] = r.samMamStatus || '-';
        if (this.selectedColumns['reportedBy']) row['Reported By'] = r.reportedBy || '-';
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Reports');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
      });
      saveAs(blob, `Activity_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);

      this.closeExportPopover();
    } catch (err) {
      console.error('Export error', err);
    } finally {
      this.isExporting = false;
    }
  }

  // ── Pagination & Mobile Views ────────────────────────────────────────────
  goToPage(page: number): void {
    this.page$.next(page);
  }

  setMobileViewMode(mode: 'quickAccess' | 'table'): void {
    this.mobileViewMode = mode;
  }
}
