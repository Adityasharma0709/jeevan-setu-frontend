import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toast } from 'ngx-sonner';
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
import { ZardIconComponent, type ZardIcon } from '@/shared/components/icon';
import { ZardComboboxComponent, type ZardComboboxOption } from '@/shared/components/combobox';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';
import { ZardDropdownImports } from '@/shared/components/dropdown';
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
  imports: [CommonModule, ReactiveFormsModule, ZardIconComponent, LottieComponent, ...ZardDropdownImports, ZardComboboxComponent, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private outreachService = inject(OutreachService);
  private authService = inject(AuthService);
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

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

  // --- INITIAL DATA STATE FOR NEW DASHBOARD DESIGN ---
  outreachActions: { label: string; count: number; bgColor: string; textColor: string; icon: ZardIcon }[] = [
    { label: 'Currently Active Pregnant women', count: 0, bgColor: 'bg-green-50', textColor: 'text-green-700', icon: 'user' },
    { label: 'Currently Active Lactating Mothers', count: 0, bgColor: 'bg-red-50', textColor: 'text-red-700', icon: 'circle-alert' },
    { label: 'Currently Active SAM Children', count: 0, bgColor: 'bg-red-50', textColor: 'text-red-700', icon: 'circle-alert' },
    { label: 'Adolescent Girls', count: 0, bgColor: 'bg-red-50', textColor: 'text-red-700', icon: 'circle-alert' },
    { label: 'Infants for EBF Promotion (<= 6m)', count: 0, bgColor: 'bg-green-50', textColor: 'text-green-700', icon: 'circle-check' },
    { label: 'Infants for CF Promotion (12year<child age<6months)', count: 0, bgColor: 'bg-blue-50', textColor: 'text-blue-700', icon: 'shield' },
    { label: 'Currently Active MAM Children', count: 0, bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', icon: 'circle-alert' },
    { label: 'Women due for delivery in next 30 days', count: 0, bgColor: 'bg-blue-50', textColor: 'text-blue-700', icon: 'shield' },
  ];

  episodesOfCare: {
    label: string;
    icon: ZardIcon;
    male: number;
    female: number;
    others: number;
    total: number;
  }[] = [
    { label: 'Adults (>19 Years)', icon: 'user', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Adolescents (10-19 Years)', icon: 'users', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Children (<5 Years)', icon: 'user', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Children (6-10 Years)', icon: 'users', male: 0, female: 0, others: 0, total: 0 },
  ];

  activities = [
    { label: 'YOUNG MARRIED WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'PREGNANT WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'MAM (0-5)', count: 0, countColor: 'text-green-600' },
    { label: 'CHILDREN BELOW 6 (0-5 YEARS) - GIRLS', count: 0, countColor: 'text-gray-900' },
    { label: 'LACTATING WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'ADOLESCENT GIRLS', count: 0, countColor: 'text-gray-900' },
    { label: 'CHILDREN ABOVE 6 (6-10 YEARS) - GIRLS', count: 0, countColor: 'text-red-600' },
    { label: 'STAKEHOLDERS', count: 0, countColor: 'text-gray-900' },
    { label: 'ADOLESCENT BOYS', count: 0, countColor: 'text-gray-900' },
    { label: 'SAM (0-5)', count: 0, countColor: 'text-red-600' },
    { label: 'CHILDREN ABOVE 6 (6-10 YEARS) - BOYS', count: 0, countColor: 'text-green-600' },
    { label: 'OTHER BENEFICIARIES', count: 0, countColor: 'text-gray-900' },
  ];

  yearFilter = new FormControl('ALL', { nonNullable: true });
  yearOptions: ZardComboboxOption[] = [{ value: 'ALL', label: 'All Years' }];

  monthFilter = new FormControl('ALL', { nonNullable: true });
  monthOptions: ZardComboboxOption[] = [{ value: 'ALL', label: 'All Months' }];

  stateFilter = new FormControl('ALL', { nonNullable: true });
  stateOptions: ZardComboboxOption[] = [{ value: 'ALL', label: 'All States' }];

  districtFilter = new FormControl('ALL', { nonNullable: true });
  districtOptions: ZardComboboxOption[] = [{ value: 'ALL', label: 'All Districts' }];

  blockFilter = new FormControl('ALL', { nonNullable: true });
  blockOptions: ZardComboboxOption[] = [{ value: 'ALL', label: 'All Blocks' }];

  filteredReportsCount = 0;

  activityFilter = new FormControl('All activity');
  activityOptions: ZardComboboxOption[] = [{ value: 'All activity', label: 'All activity' }];

  sessionFilter = new FormControl('All session');
  sessionOptions: ZardComboboxOption[] = [{ value: 'All session', label: 'All session' }];
  // ------------------------------------------

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
    this.outreachService.getOutreachActivities().subscribe(activities => {
      this.activityOptions = [
        { value: 'All activity', label: 'All activity' },
        ...activities.map(a => ({ value: String(a.id), label: a.name }))
      ];
    });

    this.activityFilter.valueChanges.subscribe(actVal => {
      this.sessionFilter.setValue('All session');
      if (actVal && actVal !== 'All activity') {
        this.outreachService.getSessions(Number(actVal)).subscribe(sessions => {
          this.sessionOptions = [
            { value: 'All session', label: 'All session' },
            ...sessions.map(s => ({ value: String(s.id), label: s.name }))
          ];
        });
      } else {
        this.sessionOptions = [{ value: 'All session', label: 'All session' }];
      }
    });

    const activity$ = this.activityFilter.valueChanges.pipe(startWith(this.activityFilter.value), distinctUntilChanged());
    const session$ = this.sessionFilter.valueChanges.pipe(startWith(this.sessionFilter.value), distinctUntilChanged());

    this.stats$ = combineLatest([activity$, session$]).pipe(
      switchMap(([actVal, sessVal]) => {
        const aId = actVal !== 'All activity' ? Number(actVal) : undefined;
        const sId = sessVal !== 'All session' ? Number(sessVal) : undefined;
        // Temporary Pause: Backend API call paused to fix high computation issues.
        // Uncomment once the backend query optimization is done.
        /*
        return this.outreachService.getDashboardStats(undefined, aId, sId).pipe(
          tap(stats => {
            if (stats.outreachActions) {
              this.outreachActions[0].count = stats.outreachActions.activePregnantWomen || 0;
              this.outreachActions[1].count = stats.outreachActions.activeLactatingMothers || 0;
              this.outreachActions[2].count = stats.outreachActions.activeSamChildren || 0;
              this.outreachActions[3].count = stats.outreachActions.adolescentGirls || 0;
              this.outreachActions[4].count = stats.outreachActions.infantsEbfPromotion || 0;
              this.outreachActions[5].count = stats.outreachActions.infantsCfPromotion || 0;
              this.outreachActions[6].count = stats.outreachActions.activeMamChildren || 0;
              this.outreachActions[7].count = stats.outreachActions.womenDueForDelivery30Days || 0;
            }

            if (stats.activities && stats.activities.length) {
              this.activities = stats.activities;
            }
          }),
          catchError((err) => {
            console.error('Error fetching dashboard stats:', err);
            toast.error('Failed to load dashboard data');
            return of({ totalBeneficiaries: 0, assignedProjects: 0, assignedLocations: 0 });
          })
        );
        */
        return of({
          totalBeneficiaries: 0,
          assignedProjects: 0,
          assignedLocations: 0,
          outreachActions: {
            activePregnantWomen: 0,
            activeLactatingMothers: 0,
            activeSamChildren: 0,
            adolescentGirls: 0,
            infantsEbfPromotion: 0,
            infantsCfPromotion: 0,
            activeMamChildren: 0,
            womenDueForDelivery30Days: 0
          },
          activities: []
        });
      }),
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
    const myBeneficiaries$ = this.outreachService.getBeneficiaries().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    const myReports$ = this.outreachService.getMyReports().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError((err) => {
        console.error('Error fetching my reports:', err);
        return of([]);
      }),
      shareReplay(1)
    );

    const enrichedReports$ = combineLatest([myReports$, myBeneficiaries$]).pipe(
      map(([reports, beneficiaries]) => {
        const benMap = new Map<number, any>();
        beneficiaries.forEach((b: any) => benMap.set(b.id, b));
        
        return reports.map((r: any) => {
          const beneficiary = benMap.get(r.beneficiaryId) || r.beneficiary;
          let child = r.child;
          if (!child && r.childId && beneficiary?.children) {
            child = beneficiary.children.find((c: any) => c.id === r.childId || c.id.toString() === r.childId.toString());
          }
          return {
            ...r,
            beneficiary,
            child,
            state: beneficiary?.state || null,
            district: beneficiary?.district || null,
            block: beneficiary?.block || null,
          };
        });
      }),
      shareReplay(1)
    );

    const locationHierarchy$ = combineLatest([enrichedProjects$, myBeneficiaries$]).pipe(
      map(([projects, beneficiaries]) => {
        const paths = new Map<string, { state: string, district: string, block: string }>();
        const addPath = (state: string, district: string, block: string) => {
          const s = (state || '').trim();
          const d = (district || '').trim();
          const b = (block || '').trim();
          if (!s) return;
          const key = `${s.toLowerCase()}||${d.toLowerCase()}||${b.toLowerCase()}`;
          if (!paths.has(key)) {
            paths.set(key, { state: s, district: d, block: b });
          }
        };

        // Extract from assigned project locations
        projects.forEach((p: any) => {
          const locations = p.locations || [];
          locations.forEach((loc: any) => {
            const sName = loc.state?.name || loc.state || '';
            const dName = loc.district?.name || loc.district || '';
            const bName = loc.block?.name || loc.block || '';
            if (sName) {
              addPath(sName, dName, bName);
            }
          });
        });

        // Extract from registered beneficiaries
        beneficiaries.forEach((b: any) => {
          if (b.state) {
            addPath(b.state, b.district || '', b.block || '');
          }
        });

        return Array.from(paths.values());
      }),
      shareReplay(1)
    );

    // Cascading dropdown options filtering
    combineLatest([
      locationHierarchy$,
      this.stateFilter.valueChanges.pipe(startWith(this.stateFilter.value)),
      this.districtFilter.valueChanges.pipe(startWith(this.districtFilter.value)),
    ]).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(([hierarchy, selectedState, selectedDistrict]) => {
      // 1. Compute States
      const states = Array.from(new Set(hierarchy.map((h: any) => h.state).filter(Boolean))).sort();
      this.stateOptions = [
        { value: 'ALL', label: 'All States' },
        ...states.map((s: any) => ({ value: s, label: s }))
      ];

      // 2. Compute Districts based on selectedState
      let filteredDistricts = hierarchy;
      if (selectedState && selectedState !== 'ALL') {
        filteredDistricts = hierarchy.filter((h: any) => h.state.toLowerCase() === selectedState.toLowerCase());
      }
      const districts = Array.from(new Set(filteredDistricts.map((h: any) => h.district).filter(Boolean))).sort();
      this.districtOptions = [
        { value: 'ALL', label: 'All Districts' },
        ...districts.map((d: any) => ({ value: d, label: d }))
      ];

      // Reset district filter if it's no longer valid
      if (selectedDistrict && selectedDistrict !== 'ALL' && !districts.includes(selectedDistrict)) {
        this.districtFilter.setValue('ALL', { emitEvent: false });
        selectedDistrict = 'ALL';
      }

      // 3. Compute Blocks based on selectedState & selectedDistrict
      let filteredBlocks = filteredDistricts;
      if (selectedDistrict && selectedDistrict !== 'ALL') {
        filteredBlocks = filteredDistricts.filter((h: any) => h.district.toLowerCase() === selectedDistrict.toLowerCase());
      }
      const blocks = Array.from(new Set(filteredBlocks.map((h: any) => h.block).filter(Boolean))).sort();
      this.blockOptions = [
        { value: 'ALL', label: 'All Blocks' },
        ...blocks.map((b: any) => ({ value: b, label: b }))
      ];

      const selectedBlock = this.blockFilter.value;
      if (selectedBlock && selectedBlock !== 'ALL' && !blocks.includes(selectedBlock)) {
        this.blockFilter.setValue('ALL', { emitEvent: false });
      }
    });

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    this.monthOptions = [
      { value: 'ALL', label: 'All Months' },
      ...MONTHS.map((m: any) => ({ value: m, label: m }))
    ];

    enrichedReports$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(reports => {
      const years = Array.from(new Set(reports.map((r: any) => {
        const d = r.date || r.createdAt;
        if (!d) return '';
        const dateObj = new Date(d);
        if (Number.isNaN(dateObj.getTime())) return '';
        return dateObj.getFullYear().toString();
      }).filter(Boolean))).sort((a, b) => b.localeCompare(a));

      this.yearOptions = [
        { value: 'ALL', label: 'All Years' },
        ...years.map((y: any) => ({ value: y, label: y }))
      ];

      const currentYear = this.yearFilter.value;
      if (currentYear && currentYear !== 'ALL' && !years.includes(currentYear)) {
        this.yearFilter.setValue('ALL', { emitEvent: false });
      }
    });

    const getReportYear = (r: any): string => {
      const d = r.date || r.createdAt;
      if (!d) return '';
      const dateObj = new Date(d);
      if (Number.isNaN(dateObj.getTime())) return '';
      return dateObj.getFullYear().toString();
    };

    const getReportMonthName = (r: any): string => {
      const d = r.date || r.createdAt;
      if (!d) return '';
      const dateObj = new Date(d);
      const mIdx = dateObj.getMonth();
      if (Number.isNaN(mIdx) || mIdx < 0 || mIdx > 11) return '';
      return MONTHS[mIdx];
    };

    // Filter reports reactively
    const filteredReports$ = combineLatest([
      enrichedReports$,
      this.yearFilter.valueChanges.pipe(startWith(this.yearFilter.value)),
      this.monthFilter.valueChanges.pipe(startWith(this.monthFilter.value)),
      this.stateFilter.valueChanges.pipe(startWith(this.stateFilter.value)),
      this.districtFilter.valueChanges.pipe(startWith(this.districtFilter.value)),
      this.blockFilter.valueChanges.pipe(startWith(this.blockFilter.value)),
    ]).pipe(
      map(([reports, year, month, state, district, block]) => {
        return reports.filter((r: any) => {
          if (year && year !== 'ALL') {
            const y = getReportYear(r);
            if (y !== year) return false;
          }
          if (month && month !== 'ALL') {
            const m = getReportMonthName(r);
            if (!m || m.toLowerCase() !== month.toLowerCase()) return false;
          }
          if (state && state !== 'ALL') {
            const s = r.state || '';
            if (s.toLowerCase() !== state.toLowerCase()) return false;
          }
          if (district && district !== 'ALL') {
            const d = r.district || '';
            if (d.toLowerCase() !== district.toLowerCase()) return false;
          }
          if (block && block !== 'ALL') {
            const b = r.block || '';
            if (b.toLowerCase() !== block.toLowerCase()) return false;
          }
          return true;
        });
      }),
      shareReplay(1)
    );

    // Calculate Episodes of Care
    filteredReports$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(reports => {
      const adults = { male: 0, female: 0, others: 0, total: 0 };
      const adolescents = { male: 0, female: 0, others: 0, total: 0 };
      const childrenUnder5 = { male: 0, female: 0, others: 0, total: 0 };
      const children6To10 = { male: 0, female: 0, others: 0, total: 0 };

      const today = new Date();

      reports.forEach((r: any) => {
        const dobStr = r.child?.dateOfBirth || r.beneficiary?.dateOfBirth;
        if (!dobStr) return;

        const dob = new Date(dobStr);
        if (Number.isNaN(dob.getTime())) return;
        let ageYears = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          ageYears--;
        }

        const genderStr = (r.child?.gender || r.beneficiary?.gender || '').trim().toLowerCase();
        let targetGroup: any;

        if (ageYears > 19) {
          targetGroup = adults;
        } else if (ageYears >= 10 && ageYears <= 19) {
          targetGroup = adolescents;
        } else if (ageYears < 5) {
          targetGroup = childrenUnder5;
        } else if (ageYears >= 5 && ageYears <= 10) {
          targetGroup = children6To10;
        } else {
          return;
        }

        targetGroup.total++;
        if (genderStr === 'male' || genderStr === 'm') {
          targetGroup.male++;
        } else if (genderStr === 'female' || genderStr === 'f') {
          targetGroup.female++;
        } else {
          targetGroup.others++;
        }
      });

      this.episodesOfCare = [
        { label: 'Adults (>19 Years)', icon: 'user', ...adults },
        { label: 'Adolescents (10-19 Years)', icon: 'users', ...adolescents },
        { label: 'Children (<5 Years)', icon: 'user', ...childrenUnder5 },
        { label: 'Children (6-10 Years)', icon: 'users', ...children6To10 },
      ];

      this.filteredReportsCount = reports.length;
    });

    // ─── RECENT CARDS ─────────────────────────────────────────────────────────

    const myRequests$ = this.outreachService.getMyRequests().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    this.recentBeneficiariesVm$ = this.createRecentCardVm$(
      myBeneficiaries$, this.recentBeneficiariesStatusFilter, this.recentBeneficiariesPage$,
      (vm: any) => { this.recentBeneficiariesLastPage = vm.page; this.recentBeneficiariesLastTotalPages = vm.totalPages; }
    );

    this.recentRequestsVm$ = this.createRecentCardVm$(
      myRequests$, this.recentRequestsStatusFilter, this.recentRequestsPage$,
      (vm: any) => { this.recentRequestsLastPage = vm.page; this.recentRequestsLastTotalPages = vm.totalPages; }
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

  getConicGradient(item: any): string {
    const total = item.total || 0;
    if (total === 0) {
      return 'conic-gradient(#E5E7EB 0% 100%)';
    }
    const pMale = (item.male / total) * 100;
    const pFemale = (item.female / total) * 100;
    const stop1 = pMale;
    const stop2 = pMale + pFemale;
    return `conic-gradient(#0EA5E9 0% ${stop1}%, #F43F5E ${stop1}% ${stop2}%, #F59E0B ${stop2}% 100%)`;
  }

  getActivityIcon(label: string): ZardIcon {
    const l = (label || '').toUpperCase();
    if (l.includes('STAKEHOLDER')) return 'users';
    if (l.includes('SAM') || l.includes('MAM')) return 'circle-alert';
    if (l.includes('PREGNANT') || l.includes('LACTATING') || l.includes('MARRIED')) return 'heart';
    return 'user';
  }

  getActivityBgClass(label: string): string {
    const l = (label || '').toUpperCase();
    if (l.includes('SAM')) return 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100/50';
    if (l.includes('MAM')) return 'bg-yellow-50 text-yellow-700 border-yellow-100 hover:bg-yellow-100/50';
    if (l.includes('PREGNANT') || l.includes('LACTATING')) return 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100/50';
    if (l.includes('STAKEHOLDER')) return 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50';
    if (l.includes('BOYS')) return 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100/50';
    if (l.includes('GIRLS')) return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/50';
    return 'bg-slate-50/80 text-slate-700 border-slate-100 hover:bg-slate-100/50';
  }
}
