import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { DashboardService } from './dashboard.service';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import {  ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent} from '@/shared/components/table/table.component'
import { Project } from '../projects/projects.service';
import { ZardIconComponent } from '@/shared/components/icon';
import { ApiService } from '@/core/services/api';
import { ProfileVm, emptyProfile, normalizeProfile } from '@/shared/utils/profile';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule,
    ZardTableComponent,
  ZardTableHeaderComponent,
  ZardTableBodyComponent,
  ZardTableRowComponent,
  ZardTableHeadComponent,
  ZardTableCellComponent,
  LottieComponent,
  ZardIconComponent,
  ZardComboboxComponent,
  ],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {

  vm$!: Observable<{
    stats: any;
    recentProjects: Project[];
    totalRecentProjects: number;
    page: number;
    pageSize: number;
    pageCount: number;
    statusFilter: StatusFilter;
  }>;
  profile$!: Observable<ProfileVm>;
  options: AnimationOptions = { path: '/loading.json' };

  readonly statusOptions: ZardComboboxOption[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Inactive', value: 'INACTIVE' },
  ];

  private readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private readonly statusFilter$ = new BehaviorSubject<StatusFilter>('ALL');

  constructor(private api: DashboardService, private coreApi: ApiService) {
    this.profile$ = this.coreApi.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'System Admin')),
      catchError(() => of(emptyProfile('System Admin'))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    const stats$ = this.api.getSuperAdminStats().pipe(
      catchError(() => of(null)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const allRecentProjects$ = this.api.getProjectsSortedByRecent().pipe(
      catchError(() => of([] as Project[])),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const page$ = this.page$.asObservable().pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    const statusFilter$ = this.statusFilter$.asObservable().pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.vm$ = combineLatest({
      stats: stats$,
      all: allRecentProjects$,
      page: page$,
      statusFilter: statusFilter$,
    }).pipe(
      map(({ stats, all, page, statusFilter }) => {
        const filtered =
          statusFilter === 'ALL'
            ? all
            : all.filter(
                (p) => (p.status || '').toUpperCase() === statusFilter
              );

        const total = filtered.length;
        const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), pageCount);
        const startIndex = (safePage - 1) * this.pageSize;
        const recentProjects = filtered.slice(startIndex, startIndex + this.pageSize);

        return {
          stats,
          recentProjects,
          totalRecentProjects: total,
          page: safePage,
          pageSize: this.pageSize,
          pageCount,
          statusFilter,
        };
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  prevPage() {
    this.page$.next(Math.max(1, this.page$.value - 1));
  }

  nextPage() {
    this.page$.next(this.page$.value + 1);
  }

  setPage(page: number) {
    const p = Number(page);
    if (!Number.isFinite(p)) return;
    this.page$.next(Math.max(1, Math.floor(p)));
  }

  setStatusFilter(filter: StatusFilter) {
    this.statusFilter$.next(filter);
    this.page$.next(1);
  }
}
