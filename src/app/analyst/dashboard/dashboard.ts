import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs/operators';
import { combineLatest, map, shareReplay, BehaviorSubject, Observable } from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '../../core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardInputDirective } from '@/shared/components/input';
import { ZardIconComponent } from '@/shared/components/icon';
import {
  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
} from '@/shared/components/table';

export interface ReportRow {
  reportId: number;
  beneficiaryId: string;
  beneficiaryName: string;
  state: string;
  district: string;
  block: string;
  village: string;
  awcCenter: string;
  activity: string;
  session: string;
  reportData: any;
  reportingDate: string;
  reportedBy: string;
  // Beneficiary detail fields
  dateOfBirth?: string | null;
  gender?: string | null;
  guardianName?: string | null;
  dateOfMarriage?: string | null;
  womanAgeAtMarriage?: number | null;
  husbandAgeAtMarriage?: number | null;
  maritalStatus?: string | null;
}

@Component({
  selector: 'app-analyst-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LottieComponent,
    ZardButtonComponent,
    ZardInputDirective,
    ZardIconComponent,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
  ],
})
export class AnalystDashboard implements OnInit {
  readonly loading = signal(true);
  readonly allReports = signal<ReportRow[]>([]);
  readonly downloadLoading = signal(false);
  readonly selectedReport = signal<ReportRow | null>(null);

  readonly options: AnimationOptions = { path: '/loading.json' };

  // Pagination
  readonly pageSize = 15;
  private readonly page$ = new BehaviorSubject<number>(1);
  lastPage = 1;
  lastTotalPages = 1;

  // Search & Sort
  searchControl = new FormControl('');
  readonly sortCol$ = new BehaviorSubject<keyof ReportRow | null>(null);
  readonly sortDir$ = new BehaviorSubject<'asc' | 'desc'>('asc');

  readonly filtered$: Observable<ReportRow[]> = combineLatest([
    this.searchControl.valueChanges.pipe(startWith('')),
    this.sortCol$,
    this.sortDir$
  ]).pipe(
    debounceTime(200),
    map(([search, sortCol, sortDir]) => {
      const q = (search ?? '').toLowerCase().trim();
      let rows = this.allReports();
      
      if (q) {
        rows = rows.filter(r =>
          r.beneficiaryId.toLowerCase().includes(q) ||
          r.beneficiaryName.toLowerCase().includes(q) ||
          r.state.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q) ||
          r.block.toLowerCase().includes(q) ||
          r.village.toLowerCase().includes(q) ||
          r.awcCenter.toLowerCase().includes(q) ||
          r.activity.toLowerCase().includes(q) ||
          r.session.toLowerCase().includes(q)
        );
      }

      if (sortCol) {
        rows = [...rows].sort((a, b) => {
          let aVal: any = a[sortCol];
          let bVal: any = b[sortCol];
          
          if (sortCol === 'reportData') {
             aVal = this.formatReportData(aVal);
             bVal = this.formatReportData(bVal);
          } else if (sortCol === 'reportingDate') {
             aVal = new Date(aVal as string).getTime();
             bVal = new Date(bVal as string).getTime();
          } else {
             if (typeof aVal === 'string') aVal = aVal.toLowerCase();
             if (typeof bVal === 'string') bVal = bVal.toLowerCase();
          }

          if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return rows;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  sortBy(col: keyof ReportRow) {
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

  readonly pager$ = combineLatest([this.filtered$, this.page$]).pipe(
    map(([rows, page]) => {
      const total = rows.length;
      const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const startIndex = (safePage - 1) * this.pageSize;
      const items = rows.slice(startIndex, startIndex + this.pageSize);
      const from = total === 0 ? 0 : startIndex + 1;
      const to = total === 0 ? 0 : Math.min(startIndex + this.pageSize, total);

      this.lastPage = safePage;
      this.lastTotalPages = totalPages;

      return { items, page: safePage, total, totalPages, from, to };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.loading.set(true);
    this.api.get<ReportRow[]>('users/analyst/dashboard/reports', undefined, { cache: 'reload' }).subscribe({
      next: (data) => {
        this.allReports.set(data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
  }

  formatDate(d: string | Date | null | undefined): string {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Returns flat key-value pairs from reportData for badge rendering */
  getReportEntries(data: any): { key: string; value: string }[] {
    const entries: { key: string; value: string }[] = [];
    
    const flatten = (obj: any) => {
      if (obj === null || obj === undefined) return;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => flatten(item));
      } else if (typeof obj === 'object') {
        for (const [key, val] of Object.entries(obj)) {
          if (val === null || val === undefined || val === '') continue;
          
          if (typeof val === 'object') {
            flatten(val);
          } else {
            entries.push({
              key: this.camelToLabel(key),
              value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)
            });
          }
        }
      }
    };
    
    flatten(data);
    return entries;
  }

  private camelToLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }

  formatReportData(data: any): string {
    return this.getReportEntries(data)
      .map(e => `${e.key}: ${e.value}`)
      .join(' | ') || '-';
  }

  /** Get a specific top-level field from reportData */
  getReportField(data: any, field: string): string {
    if (!data || typeof data !== 'object') return '-';
    const val = data[field];
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  /** Get a screeningDetails sub-field from reportData */
  getScreeningDetail(data: any, field: string): string {
    if (!data?.screeningDetails || typeof data.screeningDetails !== 'object') return '-';
    const val = data.screeningDetails[field];
    if (val === null || val === undefined || val === '') return '-';
    return String(val);
  }

  /** Calculate age from ISO date string */
  getAge(dateOfBirth: string | null | undefined): string {
    if (!dateOfBirth) return '-';
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return String(age);
  }

  openDetail(row: ReportRow) {
    this.selectedReport.set(row);
  }

  closeDetail() {
    this.selectedReport.set(null);
  }

  async downloadExcel() {
    this.downloadLoading.set(true);
    try {
      const rows = this.allReports();
      if (!rows.length) {
        this.downloadLoading.set(false);
        return;
      }

      // Build flat data for Excel
      const excelData = rows.map((r, i) => ({
        'S.No': i + 1,
        'Beneficiary ID': r.beneficiaryId,
        'Beneficiary Name': r.beneficiaryName,
        'Gender': r.gender || '-',
        'Date of Birth': r.dateOfBirth ? this.formatDate(r.dateOfBirth) : '-',
        'Age': this.getAge(r.dateOfBirth),
        'Guardian Name': r.guardianName || '-',
        'Marital Status': r.maritalStatus || '-',
        'Marriage Date': r.dateOfMarriage ? this.formatDate(r.dateOfMarriage) : '-',
        'Age at Marriage (Woman)': r.womanAgeAtMarriage != null ? r.womanAgeAtMarriage : '-',
        'Age at Marriage (Husband)': r.husbandAgeAtMarriage != null ? r.husbandAgeAtMarriage : '-',
        'State': r.state,
        'District': r.district,
        'Block': r.block,
        'Village': r.village,
        'AWC Center': r.awcCenter,
        'Activity': r.activity,
        'Session': r.session,
        'Screening': this.getReportField(r.reportData, 'screening'),
        'Height (cm)': this.getScreeningDetail(r.reportData, 'height'),
        'Weight (kg)': this.getScreeningDetail(r.reportData, 'weight'),
        'Hb (g/dL)': this.getScreeningDetail(r.reportData, 'hb'),
        'BP': this.getScreeningDetail(r.reportData, 'bp'),
        'Sugar': this.getScreeningDetail(r.reportData, 'sugar'),
        'Cervical Cancer': this.getScreeningDetail(r.reportData, 'cervicalCancer'),
        'Breast Cancer': this.getScreeningDetail(r.reportData, 'breastCancer'),
        'Pads': this.getScreeningDetail(r.reportData, 'pads'),
        'Pregnancy Status': this.getReportField(r.reportData, 'pregnancyStatus'),
        'LMP Date': this.getReportField(r.reportData, 'lmpDate'),
        'SAM/MAM Status': this.getReportField(r.reportData, 'samMamStatus'),
        'Reporting Date': this.formatDate(r.reportingDate),
        'Reported By': r.reportedBy,
      }));


      // Dynamic import to avoid SSR issues
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = Object.keys(excelData[0]).map(key => ({
        wch: Math.max(key.length, ...excelData.map(r => String((r as any)[key] ?? '').length)) + 2,
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporting Data');

      const fileName = `analyst-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error('Excel download failed', e);
    } finally {
      this.downloadLoading.set(false);
    }
  }
}
