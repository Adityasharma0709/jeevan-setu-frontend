import { Injectable, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, combineLatest, Observable, of, forkJoin } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap, tap, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '@/core/services/auth';
import { ApiService } from '@/core/services/api';
import { AnalystService } from '../analyst.service';
import { normalizeProfile, emptyProfile, ProfileVm } from '@/shared/utils/profile';
import { ZardComboboxOption } from '@/shared/components/combobox';
import { OutreachAction, EpisodeOfCare, ActivityStat } from './models/dashboard.types';

@Injectable()
export class DashboardFacade {
  private analystService = inject(AnalystService);
  private authService = inject(AuthService);
  private api = inject(ApiService);

  private currentUserId = Number(this.authService.getCurrentUser()?.sub) || undefined;

  // -- Filters --
  activityFilter = new FormControl('All activity', { nonNullable: true });
  sessionFilter = new FormControl('All session', { nonNullable: true });
  yearFilter = new FormControl('ALL', { nonNullable: true });
  monthFilter = new FormControl('ALL', { nonNullable: true });
  stateFilter = new FormControl('ALL', { nonNullable: true });
  districtFilter = new FormControl('ALL', { nonNullable: true });
  blockFilter = new FormControl('ALL', { nonNullable: true });
  awcFilter = new FormControl('ALL', { nonNullable: true });
  adminFilter = new FormControl('ALL', { nonNullable: true });
  managerFilter = new FormControl('ALL', { nonNullable: true });
  workerFilter = new FormControl('ALL', { nonNullable: true });

  // -- Options Subjects --
  private adminOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Admins' }]);
  adminOptions$ = this.adminOptionsSub.asObservable();

  private managerOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Managers' }]);
  managerOptions$ = this.managerOptionsSub.asObservable();

  private workerOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Workers' }]);
  workerOptions$ = this.workerOptionsSub.asObservable();

  private activityOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'All activity', label: 'All activity' }]);
  activityOptions$ = this.activityOptionsSub.asObservable();

  private sessionOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'All session', label: 'All session' }]);
  sessionOptions$ = this.sessionOptionsSub.asObservable();

  private stateOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All States' }]);
  stateOptions$ = this.stateOptionsSub.asObservable();

  private districtOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Districts' }]);
  districtOptions$ = this.districtOptionsSub.asObservable();

  private blockOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Blocks' }]);
  blockOptions$ = this.blockOptionsSub.asObservable();

  private awcOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All AWC Centers' }]);
  awcOptions$ = this.awcOptionsSub.asObservable();

  private yearOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Years' }]);
  yearOptions$ = this.yearOptionsSub.asObservable();

  private monthOptionsSub = new BehaviorSubject<ZardComboboxOption[]>([{ value: 'ALL', label: 'All Months' }]);
  monthOptions$ = this.monthOptionsSub.asObservable();

  // -- State Subjects --
  private outreachActionsSub = new BehaviorSubject<OutreachAction[]>([
    { label: 'Currently Active Pregnant women', count: 0, bgColor: 'bg-pink-50', textColor: 'text-pink-700', icon: 'heart' },
    { label: 'Currently Active Lactating Mothers', count: 0, bgColor: 'bg-purple-50', textColor: 'text-purple-700', icon: 'heart' },
    { label: 'Currently Active SAM Children', count: 0, bgColor: 'bg-red-50', textColor: 'text-red-700', icon: 'circle-alert' },
    { label: 'Adolescent Girls', count: 0, bgColor: 'bg-rose-50', textColor: 'text-rose-700', icon: 'users' },
    { label: 'Infants for EBF Promotion (<= 6m)', count: 0, bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', icon: 'circle-check' },
    { label: 'Infants for CF Promotion(2year<child age<6months)', count: 0, bgColor: 'bg-sky-50', textColor: 'text-sky-700', icon: 'shield' },
    { label: 'Currently Active MAM Children', count: 0, bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', icon: 'circle-alert' },
    { label: 'Women due for delivery in next 30 days', count: 0, bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', icon: 'clock' },
  ]);
  outreachActions$ = this.outreachActionsSub.asObservable();

  private selectedActionTabSub = new BehaviorSubject<number>(0);
  selectedActionTab$ = this.selectedActionTabSub.asObservable();
  
  private currentPageSub = new BehaviorSubject<number>(0);
  currentPage$ = this.currentPageSub.asObservable();
  
  private allDynamicsDataSub = new BehaviorSubject<any[] | null>(null);
  
  dynamicsTableData$!: Observable<any[] | null>;
  totalDynamicsRecords$!: Observable<number>;

  private selectedActivityTabSub = new BehaviorSubject<number>(0);
  selectedActivityTab$ = this.selectedActivityTabSub.asObservable();

  private currentActivityPageSub = new BehaviorSubject<number>(0);
  currentActivityPage$ = this.currentActivityPageSub.asObservable();

  private allActivityDataSub = new BehaviorSubject<any[] | null>(null);

  activityTableData$!: Observable<any[] | null>;
  totalActivityRecords$!: Observable<number>;

  private activitiesSub = new BehaviorSubject<ActivityStat[]>([
    { label: 'YOUNG MARRIED WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'PREGNANT WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'MAM (0-5)', count: 0, countColor: 'text-green-600' },
    { label: 'CHILDREN BELOW 6 (3-6 YEARS) - GIRLS', count: 0, countColor: 'text-gray-900' },
    { label: 'CHILDREN BELOW 6 (3-6 YEARS) - BOYS', count: 0, countColor: 'text-gray-900' },
    { label: 'LACTATING WOMEN', count: 0, countColor: 'text-gray-900' },
    { label: 'ADOLESCENT GIRLS', count: 0, countColor: 'text-gray-900' },
    { label: 'CHILDREN ABOVE 6 (6-9 YEARS) - GIRLS', count: 0, countColor: 'text-red-600' },
    { label: 'STAKEHOLDERS', count: 0, countColor: 'text-gray-900' },
    { label: 'ADOLESCENT BOYS', count: 0, countColor: 'text-gray-900' },
    { label: 'SAM (0-5)', count: 0, countColor: 'text-red-600' },
    { label: 'CHILDREN ABOVE 6 (6-9 YEARS) - BOYS', count: 0, countColor: 'text-green-600' },
    { label: 'OTHER BENEFICIARIES', count: 0, countColor: 'text-gray-900' },
  ]);
  activities$ = this.activitiesSub.asObservable();

  private episodesOfCareSub = new BehaviorSubject<EpisodeOfCare[]>([
    { label: 'Adults (>19 Years)', icon: 'user', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Adolescents (10-19 Years)', icon: 'users', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Children (0-5 Years)', icon: 'user', male: 0, female: 0, others: 0, total: 0 },
    { label: 'Children (6-9 Years)', icon: 'users', male: 0, female: 0, others: 0, total: 0 },
  ]);
  episodesOfCare$ = this.episodesOfCareSub.asObservable();

  private filteredReportsCountSub = new BehaviorSubject<number>(0);
  filteredReportsCount$ = this.filteredReportsCountSub.asObservable();

  // -- Main Observables --
  stats$!: Observable<any>;
  profile$!: Observable<ProfileVm>;
  
  private enrichedProjects$!: Observable<any[]>;
  private myBeneficiaries$!: Observable<any[]>;
  private myReports$!: Observable<any[]>;
  private enrichedReports$!: Observable<any[]>;
  private filteredReports$!: Observable<any[]>;

  constructor() {
    this.initDataStreams();
  }

  selectActionTab(index: number) {
    this.selectedActionTabSub.next(index);
    this.currentPageSub.next(0); // Reset page on tab change
  }

  nextPage() {
    this.currentPageSub.next(this.currentPageSub.value + 1);
  }

  prevPage() {
    if (this.currentPageSub.value > 0) {
      this.currentPageSub.next(this.currentPageSub.value - 1);
    }
  }

  selectActivityTab(index: number) {
    this.selectedActivityTabSub.next(index);
    this.currentActivityPageSub.next(0); // Reset page on tab change
  }

  activityNextPage() {
    this.currentActivityPageSub.next(this.currentActivityPageSub.value + 1);
  }

  activityPrevPage() {
    if (this.currentActivityPageSub.value > 0) {
      this.currentActivityPageSub.next(this.currentActivityPageSub.value - 1);
    }
  }

  private initDataStreams() {
    const activity$ = this.activityFilter.valueChanges.pipe(startWith(this.activityFilter.value), distinctUntilChanged());
    const session$ = this.sessionFilter.valueChanges.pipe(startWith(this.sessionFilter.value), distinctUntilChanged());

    // Reset pagination to 0 on filter changes
    activity$.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });
    session$.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });
    this.awcFilter.valueChanges.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });
    this.adminFilter.valueChanges.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });
    this.managerFilter.valueChanges.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });
    this.workerFilter.valueChanges.subscribe(() => {
      this.currentPageSub.next(0);
      this.currentActivityPageSub.next(0);
    });

    combineLatest([
      this.selectedActionTab$,
      activity$,
      session$,
      this.adminFilter.valueChanges.pipe(startWith(this.adminFilter.value)),
      this.managerFilter.valueChanges.pipe(startWith(this.managerFilter.value)),
      this.workerFilter.valueChanges.pipe(startWith(this.workerFilter.value)),
    ]).pipe(
      switchMap(([index, actVal, sessVal, adminVal, managerVal, workerVal]) => {
        this.allDynamicsDataSub.next(null); // Set loading state
        const actionLabel = this.outreachActionsSub.value[index]?.label || '';
        const aId = actVal && actVal !== 'All activity' ? Number(actVal) : undefined;
        const sId = sessVal && sessVal !== 'All session' ? Number(sessVal) : undefined;
        const adminId = adminVal && adminVal !== 'ALL' ? Number(adminVal) : undefined;
        const managerId = managerVal && managerVal !== 'ALL' ? Number(managerVal) : undefined;
        const workerId = workerVal && workerVal !== 'ALL' ? Number(workerVal) : undefined;
        return this.analystService.getDynamicsReports(actionLabel, aId, sId, adminId, managerId, workerId).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(data => this.allDynamicsDataSub.next(data));

    this.totalDynamicsRecords$ = this.allDynamicsDataSub.pipe(
      map(data => data ? data.length : 0)
    );

    this.dynamicsTableData$ = combineLatest([
      this.allDynamicsDataSub,
      this.currentPage$
    ]).pipe(
      map(([data, page]) => {
        if (!data) return null;
        const start = page * 10;
        return data.slice(start, start + 10);
      })
    );

    combineLatest([
      this.selectedActivityTab$,
      activity$,
      session$,
      this.adminFilter.valueChanges.pipe(startWith(this.adminFilter.value)),
      this.managerFilter.valueChanges.pipe(startWith(this.managerFilter.value)),
      this.workerFilter.valueChanges.pipe(startWith(this.workerFilter.value)),
    ]).pipe(
      switchMap(([index, actVal, sessVal, adminVal, managerVal, workerVal]) => {
        this.allActivityDataSub.next(null); // Set loading state
        const actionLabel = this.activitiesSub.value[index]?.label || '';
        const aId = actVal && actVal !== 'All activity' ? Number(actVal) : undefined;
        const sId = sessVal && sessVal !== 'All session' ? Number(sessVal) : undefined;
        const adminId = adminVal && adminVal !== 'ALL' ? Number(adminVal) : undefined;
        const managerId = managerVal && managerVal !== 'ALL' ? Number(managerVal) : undefined;
        const workerId = workerVal && workerVal !== 'ALL' ? Number(workerVal) : undefined;
        return this.analystService.getDynamicsReports(actionLabel, aId, sId, adminId, managerId, workerId).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(data => this.allActivityDataSub.next(data));

    this.totalActivityRecords$ = this.allActivityDataSub.pipe(
      map(data => data ? data.length : 0)
    );

    this.activityTableData$ = combineLatest([
      this.allActivityDataSub,
      this.currentActivityPage$
    ]).pipe(
      map(([data, page]) => {
        if (!data) return null;
        const start = page * 10;
        return data.slice(start, start + 10);
      })
    );

    // 1. Base API Calls
    this.analystService.getAnalystActivities().subscribe(activities => {
      this.activityOptionsSub.next([
        { value: 'All activity', label: 'All activity' },
        ...activities.map(a => ({ value: String(a.id), label: a.name }))
      ]);
    });

    this.activityFilter.valueChanges.subscribe(actVal => {
      this.sessionFilter.setValue('All session');
      if (actVal && actVal !== 'All activity') {
        this.analystService.getAnalystSessions(Number(actVal)).subscribe(sessions => {
          this.sessionOptionsSub.next([
            { value: 'All session', label: 'All session' },
            ...sessions.map(s => ({ value: String(s.id), label: s.name }))
          ]);
        });
      } else {
        this.sessionOptionsSub.next([{ value: 'All session', label: 'All session' }]);
      }
    });

    this.stats$ = combineLatest([
      activity$,
      session$,
      this.adminFilter.valueChanges.pipe(startWith(this.adminFilter.value)),
      this.managerFilter.valueChanges.pipe(startWith(this.managerFilter.value)),
      this.workerFilter.valueChanges.pipe(startWith(this.workerFilter.value)),
    ]).pipe(
      switchMap(([actVal, sessVal, adminVal, managerVal, workerVal]) => {
        const aId = actVal && actVal !== 'All activity' ? Number(actVal) : undefined;
        const sId = sessVal && sessVal !== 'All session' ? Number(sessVal) : undefined;
        const adminId = adminVal && adminVal !== 'ALL' ? Number(adminVal) : undefined;
        const managerId = managerVal && managerVal !== 'ALL' ? Number(managerVal) : undefined;
        const workerId = workerVal && workerVal !== 'ALL' ? Number(workerVal) : undefined;

        return this.analystService.getDashboardStats(undefined, aId, sId, adminId, managerId, workerId).pipe(
          tap(stats => {
            if (!stats) return;
            const actions = this.outreachActionsSub.value;
            actions[0].count = stats.outreachActions?.activePregnantWomen || 0;
            actions[1].count = stats.outreachActions?.activeLactatingMothers || 0;
            actions[2].count = stats.outreachActions?.activeSamChildren || 0;
            actions[3].count = stats.outreachActions?.adolescentGirls || 0;
            actions[4].count = stats.outreachActions?.infantsEbfPromotion || 0;
            actions[5].count = stats.outreachActions?.infantsCfPromotion || 0;
            actions[6].count = stats.outreachActions?.activeMamChildren || 0;
            actions[7].count = stats.outreachActions?.womenDueForDelivery30Days || 0;
            this.outreachActionsSub.next([...actions]);

            if (stats.activities && stats.activities.length) {
              const mappedActivities = stats.activities.map((act: any) => {
                let lbl = act.label;
                if (lbl === 'CHILDREN BELOW 6 (0-5 YEARS) - GIRLS') lbl = 'CHILDREN BELOW 6 (3-6 YEARS) - GIRLS';
                if (lbl === 'CHILDREN BELOW 6 (0-5 YEARS) - BOYS') lbl = 'CHILDREN BELOW 6 (3-6 YEARS) - BOYS';
                if (lbl === 'CHILDREN ABOVE 6 (6-10 YEARS) - GIRLS') lbl = 'CHILDREN ABOVE 6 (6-9 YEARS) - GIRLS';
                if (lbl === 'CHILDREN ABOVE 6 (6-10 YEARS) - BOYS') lbl = 'CHILDREN ABOVE 6 (6-9 YEARS) - BOYS';
                return { ...act, label: lbl };
              });
              this.activitiesSub.next(mappedActivities);
            }
          }),
          catchError(() => {
            return of({
              totalBeneficiaries: 0,
              assignedProjects: 0,
              assignedLocations: 0,
              outreachActions: {},
              activities: []
            });
          })
        );
      }),
      shareReplay(1)
    );

    // Fetch user hierarchy and setup cascading options
    this.analystService.getAnalystDashboardUsers().subscribe(res => {
      const allAdmins = res.admins || [];
      const allManagers = res.managers || [];
      const allWorkers = res.workers || [];

      this.adminOptionsSub.next([
        { value: 'ALL', label: 'All Admins' },
        ...allAdmins.map(a => ({ value: String(a.id), label: a.name }))
      ]);

      combineLatest([
        this.adminFilter.valueChanges.pipe(startWith(this.adminFilter.value)),
      ]).subscribe(([selectedAdmin]) => {
        let filteredManagers = allManagers;
        if (selectedAdmin && selectedAdmin !== 'ALL') {
          filteredManagers = allManagers.filter(m => String(m.createdByAdminId) === selectedAdmin);
        }
        
        this.managerOptionsSub.next([
          { value: 'ALL', label: 'All Managers' },
          ...filteredManagers.map(m => ({ value: String(m.id), label: m.name }))
        ]);

        const currentManager = this.managerFilter.value;
        const managerIds = filteredManagers.map(m => String(m.id));
        if (currentManager && currentManager !== 'ALL' && !managerIds.includes(currentManager)) {
          this.managerFilter.setValue('ALL', { emitEvent: false });
        }
      });

      combineLatest([
        this.adminFilter.valueChanges.pipe(startWith(this.adminFilter.value)),
        this.managerFilter.valueChanges.pipe(startWith(this.managerFilter.value)),
      ]).subscribe(([selectedAdmin, selectedManager]) => {
        let filteredWorkers = allWorkers;

        if (selectedManager && selectedManager !== 'ALL') {
          filteredWorkers = allWorkers.filter(w => String(w.createdByAdminId) === selectedManager);
        } else if (selectedAdmin && selectedAdmin !== 'ALL') {
          const adminManagers = allManagers.filter(m => String(m.createdByAdminId) === selectedAdmin).map(m => String(m.id));
          filteredWorkers = allWorkers.filter(w => adminManagers.includes(String(w.createdByAdminId)));
        }

        this.workerOptionsSub.next([
          { value: 'ALL', label: 'All Workers' },
          ...filteredWorkers.map(w => ({ value: String(w.id), label: w.name }))
        ]);

        const currentWorker = this.workerFilter.value;
        const workerIds = filteredWorkers.map(w => String(w.id));
        if (currentWorker && currentWorker !== 'ALL' && !workerIds.includes(currentWorker)) {
          this.workerFilter.setValue('ALL', { emitEvent: false });
        }
      });
    });

    this.profile$ = this.api.get('auth/me', undefined, { cache: 'reload' }).pipe(
      map((raw) => normalizeProfile(raw, 'Analyst')),
      catchError(() => of(emptyProfile('Analyst'))),
      shareReplay(1)
    );

    // 2. Fetch Projects, Beneficiaries, Reports
    this.enrichedProjects$ = this.analystService.getAssignedProjects(this.currentUserId).pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      switchMap((projects) => {
        if (!projects.length) return of([] as any[]);
        return forkJoin(
          projects.map((p) =>
            this.analystService.getProjectAssignments(p.id).pipe(
              map((res) => ({ ...p, locations: res.awcs, assignedStates: res.states })),
              catchError(() => of({ ...p, locations: [], assignedStates: [] }))
            )
          )
        );
      }),
      catchError(() => of([])),
      shareReplay(1)
    );

    this.myBeneficiaries$ = this.analystService.getBeneficiaries().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    this.myReports$ = this.analystService.getAnalystReports().pipe(
      map((rows) => Array.isArray(rows) ? rows : []),
      catchError(() => of([])),
      shareReplay(1)
    );

    // 3. Enrich Reports & Calculate Location Hierarchy
    this.enrichedReports$ = combineLatest([this.myReports$, this.myBeneficiaries$]).pipe(
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

    const locationHierarchy$ = combineLatest([this.enrichedProjects$, this.myBeneficiaries$]).pipe(
      map(([projects, beneficiaries]) => {
        const paths = new Map<string, { state: string, district: string, block: string, awc: string }>();
        const addPath = (state: string, district: string, block: string, awc: string) => {
          const s = (state || '').trim();
          const d = (district || '').trim();
          const b = (block || '').trim();
          const a = (awc || '').trim();
          if (!s) return;
          const key = `${s.toLowerCase()}||${d.toLowerCase()}||${b.toLowerCase()}||${a.toLowerCase()}`;
          if (!paths.has(key)) paths.set(key, { state: s, district: d, block: b, awc: a });
        };

        projects.forEach((p: any) => {
          (p.locations || []).forEach((loc: any) => {
            const sName = loc.state?.name || loc.state || '';
            const dName = loc.district?.name || loc.district || '';
            const bName = loc.block?.name || loc.block || '';
            const aName = loc.awcName || loc.village || '';
            if (sName) addPath(sName, dName, bName, aName);
          });
        });

        beneficiaries.forEach((b: any) => {
          if (b.state) {
            const aName = b.location?.awcName || b.location?.village || b.village || '';
            addPath(b.state, b.district || '', b.block || '', aName);
          }
        });

        return Array.from(paths.values());
      }),
      shareReplay(1)
    );

    // 4. Cascade Location Dropdowns
    combineLatest([
      locationHierarchy$,
      this.stateFilter.valueChanges.pipe(startWith(this.stateFilter.value)),
      this.districtFilter.valueChanges.pipe(startWith(this.districtFilter.value)),
      this.blockFilter.valueChanges.pipe(startWith(this.blockFilter.value)),
    ]).subscribe(([hierarchy, selectedState, selectedDistrict, selectedBlock]) => {
      const states = Array.from(new Set(hierarchy.map((h: any) => h.state).filter(Boolean))).sort();
      this.stateOptionsSub.next([{ value: 'ALL', label: 'All States' }, ...states.map((s: any) => ({ value: s, label: s }))]);

      let filteredDistricts = hierarchy;
      if (selectedState && selectedState !== 'ALL') {
        filteredDistricts = hierarchy.filter((h: any) => h.state.toLowerCase() === selectedState.toLowerCase());
      }
      const districts = Array.from(new Set(filteredDistricts.map((h: any) => h.district).filter(Boolean))).sort();
      this.districtOptionsSub.next([{ value: 'ALL', label: 'All Districts' }, ...districts.map((d: any) => ({ value: d, label: d }))]);

      if (selectedDistrict && selectedDistrict !== 'ALL' && !districts.includes(selectedDistrict)) {
        this.districtFilter.setValue('ALL', { emitEvent: false });
        selectedDistrict = 'ALL';
      }

      let filteredBlocks = filteredDistricts;
      if (selectedDistrict && selectedDistrict !== 'ALL') {
        filteredBlocks = filteredDistricts.filter((h: any) => h.district.toLowerCase() === selectedDistrict.toLowerCase());
      }
      const blocks = Array.from(new Set(filteredBlocks.map((h: any) => h.block).filter(Boolean))).sort();
      this.blockOptionsSub.next([{ value: 'ALL', label: 'All Blocks' }, ...blocks.map((b: any) => ({ value: b, label: b }))]);

      let selectedBlockVal = this.blockFilter.value;
      if (selectedBlockVal && selectedBlockVal !== 'ALL' && !blocks.includes(selectedBlockVal)) {
        this.blockFilter.setValue('ALL', { emitEvent: false });
        selectedBlockVal = 'ALL';
      }

      let filteredAwcs = filteredBlocks;
      if (selectedBlockVal && selectedBlockVal !== 'ALL') {
        filteredAwcs = filteredBlocks.filter((h: any) => h.block.toLowerCase() === selectedBlockVal.toLowerCase());
      }
      const awcs = Array.from(new Set(filteredAwcs.map((h: any) => h.awc).filter(Boolean))).sort();
      this.awcOptionsSub.next([{ value: 'ALL', label: 'All AWC Centers' }, ...awcs.map((a: any) => ({ value: a, label: a }))]);

      const selectedAwc = this.awcFilter.value;
      if (selectedAwc && selectedAwc !== 'ALL' && !awcs.includes(selectedAwc)) {
        this.awcFilter.setValue('ALL', { emitEvent: false });
      }
    });

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.monthOptionsSub.next([{ value: 'ALL', label: 'All Months' }, ...MONTHS.map((m: any) => ({ value: m, label: m }))]);

    this.enrichedReports$.subscribe(reports => {
      const years = Array.from(new Set(reports.map((r: any) => {
        const d = r.date || r.createdAt;
        if (!d) return '';
        const dateObj = new Date(d);
        if (Number.isNaN(dateObj.getTime())) return '';
        return dateObj.getFullYear().toString();
      }).filter(Boolean))).sort((a, b) => b.localeCompare(a));

      this.yearOptionsSub.next([{ value: 'ALL', label: 'All Years' }, ...years.map((y: any) => ({ value: y, label: y }))]);
      const currentYear = this.yearFilter.value;
      if (currentYear && currentYear !== 'ALL' && !years.includes(currentYear)) {
        this.yearFilter.setValue('ALL', { emitEvent: false });
      }
    });

    const getReportYear = (r: any): string => {
      const d = r.date || r.createdAt;
      if (!d) return '';
      const dateObj = new Date(d);
      return Number.isNaN(dateObj.getTime()) ? '' : dateObj.getFullYear().toString();
    };

    const getReportMonthName = (r: any): string => {
      const d = r.date || r.createdAt;
      if (!d) return '';
      const dateObj = new Date(d);
      const mIdx = dateObj.getMonth();
      return (Number.isNaN(mIdx) || mIdx < 0 || mIdx > 11) ? '' : MONTHS[mIdx];
    };

    // 5. Apply Report Filters & Episodes
    this.filteredReports$ = combineLatest([
      this.enrichedReports$,
      this.yearFilter.valueChanges.pipe(startWith(this.yearFilter.value)),
      this.monthFilter.valueChanges.pipe(startWith(this.monthFilter.value)),
      this.stateFilter.valueChanges.pipe(startWith(this.stateFilter.value)),
      this.districtFilter.valueChanges.pipe(startWith(this.districtFilter.value)),
      this.blockFilter.valueChanges.pipe(startWith(this.blockFilter.value)),
      this.awcFilter.valueChanges.pipe(startWith(this.awcFilter.value)),
    ]).pipe(
      map(([reports, year, month, state, district, block, awc]) => {
        return reports.filter((r: any) => {
          if (year && year !== 'ALL' && getReportYear(r) !== year) return false;
          if (month && month !== 'ALL' && getReportMonthName(r).toLowerCase() !== month.toLowerCase()) return false;
          if (state && state !== 'ALL' && (r.state || '').toLowerCase() !== state.toLowerCase()) return false;
          if (district && district !== 'ALL' && (r.district || '').toLowerCase() !== district.toLowerCase()) return false;
          if (block && block !== 'ALL' && (r.block || '').toLowerCase() !== block.toLowerCase()) return false;
          if (awc && awc !== 'ALL') {
            const rAwc = r.beneficiary?.location?.awcName || r.beneficiary?.location?.village || r.beneficiary?.village || r.awcCenter || r.awc || '';
            if (rAwc.toLowerCase().trim() !== awc.toLowerCase().trim()) return false;
          }
          return true;
        });
      }),
      shareReplay(1)
    );

    this.filteredReports$.subscribe(reports => {
      const adults = { male: 0, female: 0, others: 0, total: 0 };
      const adolescents = { male: 0, female: 0, others: 0, total: 0 };
      const childrenUnder5 = { male: 0, female: 0, others: 0, total: 0 };
      const children6To10 = { male: 0, female: 0, others: 0, total: 0 };

      reports.forEach((r: any) => {
        const dobStr = r.child?.dateOfBirth || r.beneficiary?.dateOfBirth;
        if (!dobStr) return;
        const dob = new Date(dobStr);
        if (Number.isNaN(dob.getTime())) return;

        const sessionDateStr = r.date || r.createdAt;
        const sessionDate = sessionDateStr ? new Date(sessionDateStr) : new Date();

        let ageYears = sessionDate.getFullYear() - dob.getFullYear();
        const m = sessionDate.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && sessionDate.getDate() < dob.getDate())) ageYears--;

        const genderStr = (r.child?.gender || r.beneficiary?.gender || '').trim().toLowerCase();
        let targetGroup: any;

        if (ageYears > 19) targetGroup = adults;
        else if (ageYears >= 10 && ageYears <= 19) targetGroup = adolescents;
        else if (ageYears < 6) targetGroup = childrenUnder5;
        else if (ageYears >= 6 && ageYears < 10) targetGroup = children6To10;
        else return;

        targetGroup.total++;
        if (genderStr === 'male' || genderStr === 'm') targetGroup.male++;
        else if (genderStr === 'female' || genderStr === 'f') targetGroup.female++;
        else targetGroup.others++;
      });

      this.episodesOfCareSub.next([
        { label: 'Adults (>19 Years)', icon: 'user', ...adults },
        { label: 'Adolescents (10-19 Years)', icon: 'users', ...adolescents },
        { label: 'Children (0-5 Years)', icon: 'user', ...childrenUnder5 },
        { label: 'Children (6-9 Years)', icon: 'users', ...children6To10 },
      ]);
      this.filteredReportsCountSub.next(reports.length);
    });
  }
}
