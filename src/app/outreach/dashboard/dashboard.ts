import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { AuthService } from '@/core/services/auth';
import { ZardIconComponent } from '@/shared/components/icon';
import { ZardComboboxComponent, ZardComboboxOption } from '@/shared/components/combobox';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ApiService } from '@/core/services/api';
import { ProfileVm, emptyProfile, normalizeProfile } from '@/shared/utils/profile';

import { OutreachService } from '../outreach.service';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface RecentCardPagerVm<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AssignedProjectsPagerVm {
  items: any[];
  page: number;
  pageSize: number;
  total: number;
  totalAll: number;
  totalPages: number;
  from: number;
  to: number;
  filter: ProjectStatusFilter;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ZardIconComponent, LottieComponent, ZardComboboxComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private outreachService = inject(OutreachService);
  private authService = inject(AuthService);
  private api = inject(ApiService);

  private currentUserId = Number(this.authService.getCurrentUser()?.sub) || undefined;

  options: AnimationOptions = { path: '/loading.json' };
  subLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };

  stats$!: Observable<any>;
  profile$!: Observable<ProfileVm>;
  assignedProjectsVm$!: Observable<AssignedProjectsPagerVm>;
  recentBeneficiariesVm$!: Observable<RecentCardPagerVm<any>>;
  recentRequestsVm$!: Observable<RecentCardPagerVm<any>>;

  recentBeneficiariesStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  recentRequestsStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  projectStatusFilter = new FormControl<ProjectStatusFilter>('ALL', { nonNullable: true });

  private readonly recentCardPageSize = 3;
  private readonly recentBeneficiariesPage$ = new BehaviorSubject<number>(1);
  private readonly recentRequestsPage$ = new BehaviorSubject<number>(1);
  private recentBeneficiariesLastPage = 1;
  private recentBeneficiariesLastTotalPages = 1;
  private recentRequestsLastPage = 1;
  private recentRequestsLastTotalPages = 1;

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  readonly statusOptions: ZardComboboxOption[] = [
    { value: 'ALL', label: 'All Status' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ];

  ngOnInit() {
    // ─── STATS ────────────────────────────────────────────────────────────────
    this.stats$ = this.outreachService.getDashboardStats(this.currentUserId).pipe(
      catchError(() => of({ totalBeneficiaries: 0, assignedProjects: 0, assignedLocations: 0 })),
      shareReplay(1)
    );
    this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'Outreach Worker')),
      catchError(() => of(emptyProfile('Outreach Worker'))),
      shareReplay(1),
    );

    // ─── ASSIGNED PROJECTS (enriched with locations) ──────────────────────────
    const enrichedProjects$ = this.outreachService.getAssignedProjects(this.currentUserId).pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      switchMap((projects) => {
        if (!projects.length) return of([] as any[]);
        return forkJoin(
          projects.map((p) =>
            this.outreachService.getProjectAssignments(p.id).pipe(
              map((res) => ({ 
                ...p, 
                locations: res.awcs,
                assignedStates: res.states 
              })),
              catchError(() => of({ ...p, locations: [], assignedStates: [] }))
            )
          )
        );
      }),
      catchError(() => of([])),
      shareReplay(1)
    );

    const projStatus$ = this.projectStatusFilter.valueChanges.pipe(
      startWith(this.projectStatusFilter.value),
      distinctUntilChanged()
    );

    const filteredProjectsVm$ = combineLatest([enrichedProjects$, projStatus$]).pipe(
      tap(() => this.goToPage(1)),
      map(([projects, status]) => {
        const norm = (status ?? 'ALL').toUpperCase() as ProjectStatusFilter;
        const filtered = norm === 'ALL'
          ? projects
          : projects.filter((p) => (p?.status ?? '').toUpperCase() === norm);
        return { filtered, totalAll: projects.length, filter: norm };
      }),
      shareReplay(1)
    );

    this.assignedProjectsVm$ = combineLatest([filteredProjectsVm$, this.page$]).pipe(
      map(([vm, page]) => {
        const total = vm.filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * this.pageSize;
        const end = Math.min(start + this.pageSize, total);
        return {
          items: vm.filtered.slice(start, end),
          page: safePage,
          pageSize: this.pageSize,
          total,
          totalAll: vm.totalAll,
          totalPages,
          from: total === 0 ? 0 : start + 1,
          to: total === 0 ? 0 : end,
          filter: vm.filter,
        };
      }),
      tap((vm) => {
        if (vm.page !== this.page$.getValue()) this.page$.next(vm.page);
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay(1)
    );

    // ─── RECENT CARDS ─────────────────────────────────────────────────────────
    const myBeneficiaries$ = this.outreachService.getBeneficiaries().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    const myRequests$ = this.outreachService.getMyRequests().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    this.recentBeneficiariesVm$ = this.createRecentCardVm$(
      myBeneficiaries$, this.recentBeneficiariesStatusFilter, this.recentBeneficiariesPage$,
      (vm) => { this.recentBeneficiariesLastPage = vm.page; this.recentBeneficiariesLastTotalPages = vm.totalPages; }
    );

    this.recentRequestsVm$ = this.createRecentCardVm$(
      myRequests$, this.recentRequestsStatusFilter, this.recentRequestsPage$,
      (vm) => { this.recentRequestsLastPage = vm.page; this.recentRequestsLastTotalPages = vm.totalPages; }
    );
  }

  private createRecentCardVm$<T extends { status?: string; createdAt?: string; id?: number }>(
    source$: Observable<T[]>,
    statusControl: FormControl<StatusFilter>,
    page$: BehaviorSubject<number>,
    onVm?: (vm: RecentCardPagerVm<T>) => void
  ): Observable<RecentCardPagerVm<T>> {
    const status$ = statusControl.valueChanges.pipe(
      startWith(statusControl.value),
      distinctUntilChanged(),
      tap(() => page$.next(1)),
      shareReplay(1)
    );

    return combineLatest([source$, status$, page$]).pipe(
      map(([rows, status, page]) => {
        const sorted = this.sortByMostRecent(rows || []);
        const norm = (status ?? 'ALL').toUpperCase() as StatusFilter;
        const filtered = norm === 'ALL'
          ? sorted
          : sorted.filter((r) => (r?.status ?? 'PENDING').toUpperCase() === norm);

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / this.recentCardPageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * this.recentCardPageSize;

        return { items: filtered.slice(start, start + this.recentCardPageSize), page: safePage, pageSize: this.recentCardPageSize, total, totalPages };
      }),
      tap((vm) => { if (vm.page !== page$.getValue()) page$.next(vm.page); onVm?.(vm); }),
      shareReplay(1)
    );
  }

  private sortByMostRecent<T extends { createdAt?: string; id?: number }>(rows: T[]) {
    return [...(rows || [])].sort((a, b) => {
      const d = this.getMs(b) - this.getMs(a);
      return d !== 0 ? d : Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });
  }

  private getMs(e: { createdAt?: string }) {
    const ms = Date.parse(e?.createdAt ?? '');
    return Number.isFinite(ms) ? ms : 0;
  }

  prevRecentBeneficiariesPage() { this.recentBeneficiariesPage$.next(Math.max(1, this.recentBeneficiariesLastPage - 1)); }
  nextRecentBeneficiariesPage() { this.recentBeneficiariesPage$.next(Math.min(this.recentBeneficiariesLastTotalPages, this.recentBeneficiariesLastPage + 1)); }
  prevRecentRequestsPage() { this.recentRequestsPage$.next(Math.max(1, this.recentRequestsLastPage - 1)); }
  nextRecentRequestsPage() { this.recentRequestsPage$.next(Math.min(this.recentRequestsLastTotalPages, this.recentRequestsLastPage + 1)); }

  goToPage(page: number) { this.page$.next(Math.max(1, Math.floor(Number(page) || 1))); }
  prevPage() { this.page$.next(Math.max(1, this.lastPage - 1)); }
  nextPage() { this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1)); }

  getLocationPart(val: any): string {
    if (!val) return '-';
    if (typeof val === 'string') return val;
    return val.name || val.awcName || val.locationCode || val.label || '-';
  }
}
