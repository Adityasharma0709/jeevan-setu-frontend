import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, map, Observable, shareReplay } from 'rxjs';
import { AdminService } from '../admin.service';
import { AuthService } from '../../core/services/auth';
import { ZardIconComponent } from '@/shared/components/icon';
import { LottieComponent, AnimationOptions } from 'ngx-lottie';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ZardIconComponent, LottieComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  stats$!: Observable<any>;
  assignedProjects$!: Observable<any[]>;
  myGroups$!: Observable<any[]>;
  myActivities$!: Observable<any[]>;
  mySessions$!: Observable<any[]>;

  myGroupsCount$!: Observable<number>;
  myActivitiesCount$!: Observable<number>;
  mySessionsCount$!: Observable<number>;

  myReportStats$!: Observable<any[]>;
  currentUserId?: number;
  options: AnimationOptions = { path: '/loading.json' };

  constructor(
    private adminService: AdminService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    const currentUser = this.authService.getCurrentUser();
    const currentUserId = Number(currentUser?.sub) || undefined;
    this.currentUserId = currentUserId;
    this.stats$ = this.adminService.getAdminDashboard();
    this.assignedProjects$ = this.adminService.getAssignedProjects(currentUserId);

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
