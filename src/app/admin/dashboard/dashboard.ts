import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { combineLatest, distinctUntilChanged, map, Observable, shareReplay, startWith } from 'rxjs';
import { AdminService } from '../admin.service';
import { AuthService } from '../../core/services/auth';
import { ZardIconComponent } from '@/shared/components/icon';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

type ProjectStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ZardIconComponent, LottieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats$!: Observable<any>;
  assignedProjectsVm$!: Observable<{
    projects: any[];
    total: number;
    shown: number;
    filter: ProjectStatusFilter;
  }>;
  myGroups$!: Observable<any[]>;
  myActivities$!: Observable<any[]>;
  mySessions$!: Observable<any[]>;

  myGroupsCount$!: Observable<number>;
  myActivitiesCount$!: Observable<number>;
  mySessionsCount$!: Observable<number>;

  myReportStats$!: Observable<any[]>;
  currentUserId?: number;
  options: AnimationOptions = { path: '/loading.json' };

  projectStatusFilter = new FormControl<ProjectStatusFilter>('ALL', { nonNullable: true });

  constructor(
    private adminService: AdminService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = Number(currentUser?.sub) || undefined;
    this.currentUserId = currentUserId;
    this.stats$ = this.adminService.getAdminDashboard();

    const assignedProjects$ = this.adminService.getAssignedProjects(currentUserId).pipe(
      map((rows) => (Array.isArray(rows) ? rows : [])),
      shareReplay(1)
    );

    const status$ = this.projectStatusFilter.valueChanges.pipe(
      startWith(this.projectStatusFilter.value),
      distinctUntilChanged()
    );

    this.assignedProjectsVm$ = combineLatest([assignedProjects$, status$]).pipe(
      map(([projects, status]) => {
        const normalizedStatus = (status ?? 'ALL').toString().toUpperCase() as ProjectStatusFilter;
        const filtered =
          normalizedStatus === 'ALL'
            ? projects
            : projects.filter(
              (p) => (p?.status ?? '').toString().toUpperCase() === normalizedStatus
            );

        return {
          projects: filtered,
          total: projects.length,
          shown: filtered.length,
          filter: normalizedStatus,
        };
      }),
      shareReplay(1)
    );

    this.myGroups$ = this.adminService.getGroups().pipe(
      map((rows) => (rows ?? []).filter((g) => g?.creator?.id === this.currentUserId)),
      shareReplay(1)
    );

    this.myActivities$ = this.adminService.getActivities().pipe(
      map((rows) => (rows ?? []).filter((a) => a?.creator?.id === this.currentUserId)),
      shareReplay(1)
    );

    this.mySessions$ = this.adminService.getAllSessions().pipe(
      map((rows) => (rows ?? []).filter((s) => s?.creator?.id === this.currentUserId)),
      shareReplay(1)
    );

    this.myGroupsCount$ = this.myGroups$.pipe(map((rows) => rows.length));
    this.myActivitiesCount$ = this.myActivities$.pipe(map((rows) => rows.length));
    this.mySessionsCount$ = this.mySessions$.pipe(map((rows) => rows.length));

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
}
