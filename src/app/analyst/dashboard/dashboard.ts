import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ApiService } from '../../core/services/api';
import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';

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
  dateOfBirth?: string | null;
  gender?: string | null;
  guardianName?: string | null;
  maritalStatus?: string | null;
  dateOfMarriage?: string | null;
  womanAgeAtMarriage?: number | null;
  husbandAgeAtMarriage?: number | null;
}

export interface DashboardAlert {
  type: 'danger' | 'warning' | 'info';
  beneficiaryName: string;
  beneficiaryId: string;
  message: string;
  activity: string;
  date: string;
  rawReport: ReportRow;
}

@Component({
  selector: 'app-analyst-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  imports: [
    CommonModule,
    RouterModule,
    LottieComponent,
    ZardButtonComponent,
    ZardIconComponent,
  ],
})
export class AnalystDashboard implements OnInit {
  readonly loading = signal(true);
  readonly allReports = signal<ReportRow[]>([]);
  readonly selectedReport = signal<ReportRow | null>(null);

  readonly options: AnimationOptions = { path: '/loading.json' };

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

  // --- Derived Statistics ---
  
  readonly totalReports = computed(() => this.allReports().length);

  readonly uniqueBeneficiariesCount = computed(() => {
    const ids = new Set(this.allReports().map(r => r.beneficiaryId));
    return ids.size;
  });

  readonly activePregnanciesCount = computed(() => {
    return this.allReports().filter(r => {
      const status = this.getReportField(r.reportData, 'pregnancyStatus');
      return status && status.toLowerCase() === 'active';
    }).length;
  });

  readonly screeningsConductedCount = computed(() => {
    return this.allReports().filter(r => {
      const screening = this.getReportField(r.reportData, 'screening');
      return screening === 'Yes' || screening === 'YES';
    }).length;
  });

  readonly recentReports = computed(() => {
    // Sort by reportingDate descending, take top 5
    return [...this.allReports()]
      .sort((a, b) => new Date(b.reportingDate).getTime() - new Date(a.reportingDate).getTime())
      .slice(0, 5);
  });

  readonly alerts = computed<DashboardAlert[]>(() => {
    const alertsList: DashboardAlert[] = [];
    
    // Sort reports chronologically descending to show latest alerts first
    const sorted = [...this.allReports()]
      .sort((a, b) => new Date(b.reportingDate).getTime() - new Date(a.reportingDate).getTime());

    for (const r of sorted) {
      const reportData = r.reportData;
      if (!reportData) continue;

      // 1. Cervical Cancer Positive
      const cervical = this.getScreeningDetail(reportData, 'cervicalCancer');
      if (cervical && cervical.toLowerCase() === 'positive') {
        alertsList.push({
          type: 'danger',
          beneficiaryName: r.beneficiaryName,
          beneficiaryId: r.beneficiaryId,
          message: 'Screening Positive for Cervical Cancer',
          activity: r.activity,
          date: r.reportingDate,
          rawReport: r
        });
      }

      // 2. Breast Cancer Positive
      const breast = this.getScreeningDetail(reportData, 'breastCancer');
      if (breast && breast.toLowerCase() === 'positive') {
        alertsList.push({
          type: 'danger',
          beneficiaryName: r.beneficiaryName,
          beneficiaryId: r.beneficiaryId,
          message: 'Screening Positive for Breast Cancer',
          activity: r.activity,
          date: r.reportingDate,
          rawReport: r
        });
      }

      // 3. Anemia check (Hb < 10)
      const hbVal = this.getScreeningDetail(reportData, 'hb');
      if (hbVal && hbVal !== '-') {
        const hb = parseFloat(hbVal);
        if (!isNaN(hb) && hb < 11.0) {
          alertsList.push({
            type: hb < 8.0 ? 'danger' : 'warning',
            beneficiaryName: r.beneficiaryName,
            beneficiaryId: r.beneficiaryId,
            message: `Low Hemoglobin Alert: ${hb} g/dL (Anemia)`,
            activity: r.activity,
            date: r.reportingDate,
            rawReport: r
          });
        }
      }

      // 4. SAM/MAM Status Alert
      const samMam = this.getReportField(reportData, 'samMamStatus');
      if (samMam && (samMam === 'SAM' || samMam === 'MAM')) {
        alertsList.push({
          type: samMam === 'SAM' ? 'danger' : 'warning',
          beneficiaryName: r.beneficiaryName,
          beneficiaryId: r.beneficiaryId,
          message: `Malnutrition Status Identified: ${samMam}`,
          activity: r.activity,
          date: r.reportingDate,
          rawReport: r
        });
      }
    }

    return alertsList.slice(0, 10); // Return up to 10 latest alerts
  });

  // --- Helper Methods ---

  formatDate(d: string | Date | null | undefined): string {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

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

  getReportField(data: any, field: string): string {
    if (!data || typeof data !== 'object') return '-';
    const val = data[field];
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  }

  getScreeningDetail(data: any, field: string): string {
    if (!data?.screeningDetails || typeof data.screeningDetails !== 'object') return '-';
    const val = data.screeningDetails[field];
    if (val === null || val === undefined || val === '') return '-';
    return String(val);
  }

  openDetail(row: ReportRow) {
    this.selectedReport.set(row);
  }

  closeDetail() {
    this.selectedReport.set(null);
  }

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
}
