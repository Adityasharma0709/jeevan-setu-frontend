import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, startWith, switchMap, map, shareReplay, combineLatest } from 'rxjs';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

import { ZardButtonComponent } from '@/shared/components/button';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardTableComponent, ZardTableHeaderComponent, ZardTableBodyComponent, ZardTableRowComponent, ZardTableHeadComponent, ZardTableCellComponent } from '@/shared/components/table';

import { OutreachService } from '../outreach.service';

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
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

  options: AnimationOptions = { path: '/loading.json' };

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastPageCount = 1;

  isLoading = true;
  expandedReportId: number | null = null;

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
  ]).pipe(
    map(([reports, page]) => {
      const total = reports.length;
      const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
      const safePage = Math.min(Math.max(1, page), pageCount);
      const startIndex = (safePage - 1) * this.pageSize;

      this.lastPage = safePage;
      this.lastPageCount = pageCount;

      return {
        items: reports.slice(startIndex, startIndex + this.pageSize),
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
    if (!data || data.screening === 'No') return 'No';
    
    const details = data.screeningDetails;
    if (!details) return 'Yes (No details)';

    const parts: string[] = [];
    if (details.height) parts.push(`H: ${details.height}cm`);
    if (details.weight) parts.push(`W: ${details.weight}kg`);
    if (details.bp) parts.push(`BP: ${details.bp}`);
    if (details.hb) parts.push(`Hb: ${details.hb}`);
    if (details.sugar) parts.push(`Sugar: ${details.sugar}`);
    
    return `Yes (${parts.join(', ')})`;
  }
}
