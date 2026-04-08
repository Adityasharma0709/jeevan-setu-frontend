import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, catchError, distinctUntilChanged, map, Observable, of, shareReplay, startWith, tap } from 'rxjs';
import { ManagerService } from '../manager.service';
import { AuthService } from '../../core/services/auth';
import { ApiService } from '../../core/services/api';
import { ZardIconComponent } from '@/shared/components/icon';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ProfileVm, emptyProfile, normalizeProfile } from '@/shared/utils/profile';

type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

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

interface RecentCardPagerVm<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardIconComponent, LottieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats$!: Observable<any>;
  assignedProjectsVm$!: Observable<AssignedProjectsPagerVm>;
  
  myWorkers$!: Observable<any[]>;
  myBeneficiaries$!: Observable<any[]>;
  myRequests$!: Observable<any[]>;
  profile$!: Observable<ProfileVm>;

  options: AnimationOptions = { path: '/loading.json' };
  subLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };

  projectStatusFilter = new FormControl<ProjectStatusFilter>('ALL', { nonNullable: true });

  recentWorkersStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  recentBeneficiariesStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  recentRequestsStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });

  recentWorkersVm$!: Observable<RecentCardPagerVm<any>>;
  recentBeneficiariesVm$!: Observable<RecentCardPagerVm<any>>;
  recentRequestsVm$!: Observable<RecentCardPagerVm<any>>;

  private readonly recentCardPageSize = 3;
  private readonly recentWorkersPage$ = new BehaviorSubject<number>(1);
  private readonly recentBeneficiariesPage$ = new BehaviorSubject<number>(1);
  private readonly recentRequestsPage$ = new BehaviorSubject<number>(1);
  
  private recentWorkersLastPage = 1;
  private recentWorkersLastTotalPages = 1;
  private recentBeneficiariesLastPage = 1;
  private recentBeneficiariesLastTotalPages = 1;
  private recentRequestsLastPage = 1;
  private recentRequestsLastTotalPages = 1;

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private managerService: ManagerService,
    private authService: AuthService,
    private api: ApiService
  ) { }

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = Number(currentUser?.sub) || undefined;
    
    // Core stats
    this.stats$ = this.managerService.getManagerDashboard().pipe(shareReplay(1));
    this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'Manager')),
      catchError(() => of(emptyProfile('Manager'))),
      shareReplay(1),
    );

    // Projects Mapping
    const assignedProjects$ = this.managerService.getProjects(currentUserId).pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      shareReplay(1)
    );

    const status$ = this.projectStatusFilter.valueChanges.pipe(
      startWith(this.projectStatusFilter.value),
      distinctUntilChanged()
    );

    const filteredProjectsVm$ = combineLatest([assignedProjects$, status$]).pipe(
      tap(() => this.goToPage(1)),
      map(([projects, status]) => {
        const normalizedStatus = (status ?? 'ALL').toString().toUpperCase() as ProjectStatusFilter;
        const filtered =
          normalizedStatus === 'ALL'
            ? projects
            : projects.filter(
              (p) => (p?.status ?? '').toString().toUpperCase() === normalizedStatus
            );

        return {
          filtered,
          totalAll: projects.length,
          filter: normalizedStatus as ProjectStatusFilter,
        };
      }),
      shareReplay(1)
    );

    this.assignedProjectsVm$ = combineLatest([filteredProjectsVm$, this.page$]).pipe(
      map(([vm, page]) => {
        const total = vm.filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.pageSize;
        const endIndexExclusive = Math.min(startIndex + this.pageSize, total);
        const items = vm.filtered.slice(startIndex, endIndexExclusive);

        const from = total === 0 ? 0 : startIndex + 1;
        const to = total === 0 ? 0 : endIndexExclusive;

        return {
          items,
          page: safePage,
          pageSize: this.pageSize,
          total,
          totalAll: vm.totalAll,
          totalPages,
          from,
          to,
          filter: vm.filter,
        };
      }),
      tap((vm) => {
        if (vm.page !== this.page$.getValue()) this.page$.next(vm.page);
        this.lastPage = vm.page;
        this.lastTotalPages = vm.totalPages;
      }),
      shareReplay(1),
    );

    // Lists logic
    this.myWorkers$ = this.managerService.getOutreachWorkers().pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      shareReplay(1)
    );

    this.myBeneficiaries$ = this.managerService.getBeneficiaries().pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      shareReplay(1)
    );

    this.myRequests$ = this.managerService.getBeneficiaryRequests().pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      shareReplay(1)
    );

    this.recentWorkersVm$ = this.createRecentCardVm$(this.myWorkers$, this.recentWorkersStatusFilter, this.recentWorkersPage$, (vm) => {
      this.recentWorkersLastPage = vm.page;
      this.recentWorkersLastTotalPages = vm.totalPages;
    });

    this.recentBeneficiariesVm$ = this.createRecentCardVm$(this.myBeneficiaries$, this.recentBeneficiariesStatusFilter, this.recentBeneficiariesPage$, (vm) => {
      this.recentBeneficiariesLastPage = vm.page;
      this.recentBeneficiariesLastTotalPages = vm.totalPages;
    });

    this.recentRequestsVm$ = this.createRecentCardVm$(this.myRequests$, this.recentRequestsStatusFilter, this.recentRequestsPage$, (vm) => {
      this.recentRequestsLastPage = vm.page;
      this.recentRequestsLastTotalPages = vm.totalPages;
    });
  }

  private createRecentCardVm$<T extends { status?: string; createdAt?: string; id?: number }>(
    source$: Observable<T[]>,
    statusControl: FormControl<StatusFilter>,
    page$: BehaviorSubject<number>,
    onVm?: (vm: RecentCardPagerVm<T>) => void,
  ): Observable<RecentCardPagerVm<T>> {
    const status$ = statusControl.valueChanges.pipe(
      startWith(statusControl.value),
      distinctUntilChanged(),
      tap(() => page$.next(1)),
      shareReplay(1),
    );

    return combineLatest([source$, status$, page$]).pipe(
      map(([rows, status, page]) => {
        const sorted = this.sortByMostRecent(rows || []);
        const normalized = (status ?? 'ALL').toString().toUpperCase() as StatusFilter;
        const filtered =
          normalized === 'ALL'
            ? sorted
            : sorted.filter((r) => (r?.status ?? 'PENDING').toString().toUpperCase() === normalized);

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / this.recentCardPageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);

        const startIndex = (safePage - 1) * this.recentCardPageSize;
        const items = filtered.slice(startIndex, startIndex + this.recentCardPageSize);

        return {
          items,
          page: safePage,
          pageSize: this.recentCardPageSize,
          total,
          totalPages,
        };
      }),
      tap((vm) => {
        if (vm.page !== page$.getValue()) page$.next(vm.page);
        onVm?.(vm);
      }),
      shareReplay(1),
    );
  }

  private sortByMostRecent<T extends { createdAt?: string; id?: number }>(rows: T[]) {
    const items = [...(rows || [])];
    items.sort((a, b) => {
      const createdDelta = this.getCreatedAtMs(b) - this.getCreatedAtMs(a);
      if (createdDelta !== 0) return createdDelta;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });
    return items;
  }

  private getCreatedAtMs(entity: { createdAt?: string }) {
    const createdAt = entity?.createdAt;
    if (!createdAt) return 0;
    const ms = Date.parse(createdAt);
    return Number.isFinite(ms) ? ms : 0;
  }

  prevRecentWorkersPage() {
    this.recentWorkersPage$.next(Math.max(1, this.recentWorkersLastPage - 1));
  }
  nextRecentWorkersPage() {
    this.recentWorkersPage$.next(Math.min(this.recentWorkersLastTotalPages, this.recentWorkersLastPage + 1));
  }
  prevRecentBeneficiariesPage() {
    this.recentBeneficiariesPage$.next(Math.max(1, this.recentBeneficiariesLastPage - 1));
  }
  nextRecentBeneficiariesPage() {
    this.recentBeneficiariesPage$.next(Math.min(this.recentBeneficiariesLastTotalPages, this.recentBeneficiariesLastPage + 1));
  }
  prevRecentRequestsPage() {
    this.recentRequestsPage$.next(Math.max(1, this.recentRequestsLastPage - 1));
  }
  nextRecentRequestsPage() {
    this.recentRequestsPage$.next(Math.min(this.recentRequestsLastTotalPages, this.recentRequestsLastPage + 1));
  }

  goToPage(page: number) {
    const nextPage = Math.max(1, Math.floor(Number(page) || 1));
    this.page$.next(nextPage);
  }

  prevPage() {
    this.page$.next(Math.max(1, this.lastPage - 1));
  }

  nextPage() {
    this.page$.next(Math.min(this.lastTotalPages, this.lastPage + 1));
  }
}
