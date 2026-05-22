import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, catchError, distinctUntilChanged, map, Observable, of, shareReplay, startWith, tap } from 'rxjs';
import { AdminService } from '../admin.service';
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
  total: number; // filtered total
  totalAll: number; // overall total
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
  myGroups$!: Observable<any[]>;
  myActivities$!: Observable<any[]>;
  mySessions$!: Observable<any[]>;

  myGroupsCount$!: Observable<number>;
  myActivitiesCount$!: Observable<number>;
  mySessionsCount$!: Observable<number>;

  myReportStats$!: Observable<any[]>;
  profile$!: Observable<ProfileVm>;
  currentUserId?: number;
  private currentUserEmail: string | null = null;
  options: AnimationOptions = { path: '/loading.json' };
  subLoaderOptions: AnimationOptions = { path: '/loadingcircle.json' };

  projectStatusFilter = new FormControl<ProjectStatusFilter>('ALL', { nonNullable: true });

  recentGroupsStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  recentActivitiesStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });
  recentSessionsStatusFilter = new FormControl<StatusFilter>('ALL', { nonNullable: true });

  recentGroupsVm$!: Observable<RecentCardPagerVm<any>>;
  recentActivitiesVm$!: Observable<RecentCardPagerVm<any>>;
  recentSessionsVm$!: Observable<RecentCardPagerVm<any>>;

  private readonly recentCardPageSize = 2;
  private readonly recentGroupsPage$ = new BehaviorSubject<number>(1);
  private readonly recentActivitiesPage$ = new BehaviorSubject<number>(1);
  private readonly recentSessionsPage$ = new BehaviorSubject<number>(1);
  private recentGroupsLastPage = 1;
  private recentGroupsLastTotalPages = 1;
  private recentActivitiesLastPage = 1;
  private recentActivitiesLastTotalPages = 1;
  private recentSessionsLastPage = 1;
  private recentSessionsLastTotalPages = 1;

  readonly pageSize = 10;
  private readonly page$ = new BehaviorSubject<number>(1);
  private lastPage = 1;
  private lastTotalPages = 1;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private api: ApiService
  ) { }

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = Number(currentUser?.sub) || undefined;
    this.currentUserId = currentUserId;
    this.currentUserEmail = currentUser?.email ? String(currentUser.email).toLowerCase() : null;
    this.stats$ = this.adminService.getAdminDashboard();
    this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'Admin')),
      catchError(() => of(emptyProfile('Admin'))),
      shareReplay(1),
    );

    const states$ = this.adminService.getStates().pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      catchError(() => of([])),
      shareReplay(1),
    );

    const assignedProjects$ = combineLatest([
      this.adminService.getAssignedProjects(currentUserId).pipe(
        map((rows) => (Array.isArray(rows) ? rows : [])),
        catchError(() => of([])),
      ),
      states$,
    ]).pipe(
      map(([projects, states]) => {
        const stateMap = new Map<number, any>(
          (states || []).map((s: any) => [Number(s?.id), s]),
        );
        return (projects || []).map((p) => this.normalizeAssignedProject(p, stateMap));
      }),
      shareReplay(1),
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

    this.myGroups$ = this.adminService.getGroups().pipe(
      map((rows) => (rows ?? []).filter((g) => this.isOwnedByCurrentAdmin(g))),
      shareReplay(1)
    );

    this.myActivities$ = this.adminService.getActivities().pipe(
      map((rows) => (rows ?? []).filter((a) => this.isOwnedByCurrentAdmin(a))),
      shareReplay(1)
    );

    this.mySessions$ = this.adminService.getAllSessions().pipe(
      map((rows) => (rows ?? []).filter((s) => this.isOwnedByCurrentAdmin(s))),
      shareReplay(1)
    );

    this.myGroupsCount$ = this.myGroups$.pipe(map((rows) => rows.length));
    this.myActivitiesCount$ = this.myActivities$.pipe(map((rows) => rows.length));
    this.mySessionsCount$ = this.mySessions$.pipe(map((rows) => rows.length));

    this.recentGroupsVm$ = this.createRecentCardVm$(this.myGroups$, this.recentGroupsStatusFilter, this.recentGroupsPage$, (vm) => {
      this.recentGroupsLastPage = vm.page;
      this.recentGroupsLastTotalPages = vm.totalPages;
    });

    this.recentActivitiesVm$ = this.createRecentCardVm$(this.myActivities$, this.recentActivitiesStatusFilter, this.recentActivitiesPage$, (vm) => {
      this.recentActivitiesLastPage = vm.page;
      this.recentActivitiesLastTotalPages = vm.totalPages;
    });

    this.recentSessionsVm$ = this.createRecentCardVm$(this.mySessions$, this.recentSessionsStatusFilter, this.recentSessionsPage$, (vm) => {
      this.recentSessionsLastPage = vm.page;
      this.recentSessionsLastTotalPages = vm.totalPages;
    });

    this.myReportStats$ = combineLatest([this.stats$, this.myActivities$]).pipe(
      map(([stats, activities]) => {
        const reportStats = Array.isArray(stats?.reportStats) ? stats.reportStats : [];
        const activityMap = new Map<number, any>(activities.map((a) => [a.id, a]));

        return reportStats
          .filter((s: any) => activityMap.has(Number(s.activityId)))
          .map((s: any) => ({
            ...s,
            activityName: activityMap.get(Number(s.activityId))?.name,
          }));
      }),
      shareReplay(1)
    );
  }

  private normalizeAssignedProject(project: any, stateMap?: Map<number, any>): any {
    const candidates = [
      project?.locations,
      project?.awcs,
      project?.userProjectLocations,
      project?.projectLocations,
      project?.assignedLocations,
    ];

    let rawLocations: any[] = [];
    for (const c of candidates) {
      if (Array.isArray(c)) {
        rawLocations = c;
        break;
      }
    }

    const locations = rawLocations
      .map((item: any) => item?.awc ?? item?.location ?? item?.state ?? item)
      .filter(Boolean)
      .filter((loc: any) => {
        const status = (loc?.status ?? 'ACTIVE').toString().toUpperCase();
        return status === 'ACTIVE';
      });

    // Dashboard should show assigned *states* only (not AWC list).
    const states = locations.map((loc: any) => this.toAssignedStateVm(loc, stateMap)).filter(Boolean);

    // De-dupe by state id/code/name
    const seen = new Set<string>();
    const dedupedStates = states.filter((s: any, index: number) => {
      const keyCandidate = s?.id ?? s?.locationCode ?? s?.name;
      const key = keyCandidate === null || keyCandidate === undefined || String(keyCandidate).trim() === ''
        ? `idx:${index}`
        : String(keyCandidate).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const normalizedStatus = (project?.status ?? '').toString().toUpperCase();

    return {
      ...project,
      status: normalizedStatus || project?.status,
      locations: dedupedStates,
    };
  }

  private toAssignedStateVm(
    loc: any,
    stateMap?: Map<number, any>,
  ): { id?: number; name?: string; locationCode?: string } | null {
    if (!loc) return null;

    const stateObj = loc?.state && typeof loc.state === 'object' ? loc.state : null;
    const stateIdRaw = stateObj?.id ?? loc?.stateId ?? loc?.state_id;
    const stateId = Number(stateIdRaw);
    const stateFromMap = Number.isFinite(stateId) ? (stateMap?.get(stateId) ?? null) : null;

    const name =
      (typeof loc?.state === 'string' ? loc.state : null) ||
      (typeof loc?.stateName === 'string' ? loc.stateName : null) ||
      (typeof stateObj?.name === 'string' ? stateObj.name : null) ||
      (typeof stateFromMap?.name === 'string' ? stateFromMap.name : null) ||
      (typeof loc?.name === 'string' ? loc.name : null) ||
      (typeof loc?.awcName === 'string' ? loc.awcName : null) ||
      (typeof loc?.label === 'string' ? loc.label : null) ||
      undefined;

    const id = Number.isFinite(stateId) ? stateId : undefined;

    const locationCode =
      (typeof stateObj?.locationCode === 'string' ? stateObj.locationCode : null) ||
      (typeof stateObj?.code === 'string' ? stateObj.code : null) ||
      (typeof stateFromMap?.locationCode === 'string' ? stateFromMap.locationCode : null) ||
      (typeof stateFromMap?.code === 'string' ? stateFromMap.code : null) ||
      (typeof loc?.stateCode === 'string' ? loc.stateCode : null) ||
      (typeof loc?.locationCode === 'string' ? loc.locationCode : null) ||
      undefined;

    if (!name && !locationCode) return null;
    return { id, name, locationCode };
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
            : sorted.filter((r) => (r?.status ?? '').toString().toUpperCase() === normalized);

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

  prevRecentGroupsPage() {
    this.recentGroupsPage$.next(Math.max(1, this.recentGroupsLastPage - 1));
  }

  nextRecentGroupsPage() {
    this.recentGroupsPage$.next(Math.min(this.recentGroupsLastTotalPages, this.recentGroupsLastPage + 1));
  }

  prevRecentActivitiesPage() {
    this.recentActivitiesPage$.next(Math.max(1, this.recentActivitiesLastPage - 1));
  }

  nextRecentActivitiesPage() {
    this.recentActivitiesPage$.next(Math.min(this.recentActivitiesLastTotalPages, this.recentActivitiesLastPage + 1));
  }

  prevRecentSessionsPage() {
    this.recentSessionsPage$.next(Math.max(1, this.recentSessionsLastPage - 1));
  }

  nextRecentSessionsPage() {
    this.recentSessionsPage$.next(Math.min(this.recentSessionsLastTotalPages, this.recentSessionsLastPage + 1));
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

  private getCreatorId(entity: any): number | null {
    const directId = entity?.creator?.id ?? entity?.createdBy?.id ?? entity?.createdById ?? entity?.created_by;
    const creatorId = Number(directId);
    return Number.isFinite(creatorId) ? creatorId : null;
  }

  private isOwnedByCurrentAdmin(entity: any): boolean {
    const creatorId = this.getCreatorId(entity);
    if (!!creatorId && !!this.currentUserId && creatorId === this.currentUserId) {
      return true;
    }
    const creatorEmail = entity?.creator?.email || entity?.createdBy?.email;
    if (!creatorEmail || !this.currentUserEmail) {
      return false;
    }
    return String(creatorEmail).toLowerCase() === this.currentUserEmail;
  }
}
