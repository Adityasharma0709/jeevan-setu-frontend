import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, startWith, switchMap, map, shareReplay, combineLatest } from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardTableComponent, ZardTableHeaderComponent, ZardTableBodyComponent, ZardTableRowComponent, ZardTableHeadComponent, ZardTableCellComponent } from '@/shared/components/table';
import { UserProfileService } from '../../core/services/user-profile.service';

import { OutreachService } from '../outreach.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ZardButtonComponent,
    ZardIconComponent,
    ZardTableComponent,
    ZardTableHeaderComponent,
    ZardTableBodyComponent,
    ZardTableRowComponent,
    ZardTableHeadComponent,
    ZardTableCellComponent,
    LottieComponent,
  ],
  templateUrl: './activity.html',
})
export class Activity {
  private outreachService = inject(OutreachService);
  private router = inject(Router);
  private userProfile = inject(UserProfileService);

  options: AnimationOptions = { path: '/loading.json' };
  profile$ = this.userProfile.profile$;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly search$ = new BehaviorSubject<string>('');
  private readonly screeningFilter$ = new BehaviorSubject<'ALL' | 'YES' | 'NO'>('ALL');
  private lastPage = 1;
  private lastPageCount = 1;

  isLoading = true;
  expandedReportId: number | null = null;
  searchTerm = '';
  screeningFilter: 'ALL' | 'YES' | 'NO' = 'ALL';

  reports$ = this.refresh$.pipe(
    startWith(undefined),
    switchMap(() => {
      this.isLoading = true;
      this.page$.next(1); // Reset page on refresh
      return this.outreachService.getMyReports();
    }),
    map(reports => {
      this.isLoading = false;
      return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }),
    shareReplay(1)
  );

  vm$ = combineLatest([
    this.reports$,
    this.page$.asObservable(),
    this.search$.asObservable(),
    this.screeningFilter$.asObservable(),
  ]).pipe(
    map(([reports, page, search, screeningFilter]) => {
      const normalizedSearch = search.trim().toLowerCase();
      const filteredReports = reports.filter(report => {
        const screening = String(report?.reportData?.screening || 'No').toUpperCase();
        const passesScreening = screeningFilter === 'ALL' || screening === screeningFilter;

        if (!passesScreening) return false;
        if (!normalizedSearch) return true;

        const searchableText = [
          report.child?.name,
          report.beneficiary?.name,
          report.child?.uid,
          report.beneficiary?.uid,
          report.activity?.name,
          report.session?.name,
          report.date,
          this.getScreeningSummary(report),
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(normalizedSearch);
      });

      const total = filteredReports.length;
      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: filteredReports.slice(startIndex, startIndex + this.pageSize),
        total,
        page: safePage,
        pageCount,
        pageSize: this.pageSize,
        startIndex,
        endIndex: Math.min(startIndex + this.pageSize, total)
      };
    })
  );

  addReport() {
    this.router.navigate(['/outreach/report-activity']);
  }

  editReport(reportId: number) {
    this.router.navigate(['/outreach/report-activity'], { queryParams: { reportId } });
  }

  reload() {
    this.refresh$.next();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.page$.next(1);
    this.search$.next(value);
  }

  cycleScreeningFilter(): void {
    this.screeningFilter = this.screeningFilter === 'ALL'
      ? 'YES'
      : this.screeningFilter === 'YES'
        ? 'NO'
        : 'ALL';
    this.page$.next(1);
    this.screeningFilter$.next(this.screeningFilter);
  }

  get screeningFilterLabel(): string {
    return this.screeningFilter === 'ALL' ? 'All' : this.screeningFilter;
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
    if (data.pregnancyStatus === 'Yes') {
      parts.push('Pregnant');
    }

    // Nutrition Status
    if (data.samMamStatus) {
      parts.push(`Status: ${data.samMamStatus}`);
    }
    
    if (parts.length === 0) return data.screening || 'No';
    return parts.join(', ');
  }
}
