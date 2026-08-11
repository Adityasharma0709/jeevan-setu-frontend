import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../core/services/api';
import { OutreachProject, OutreachLocation, Beneficiary, OutreachActivity, OutreachSession, OutreachDashboardStats, DynamicsTableRecord } from '../outreach/outreach.service';

@Injectable({
  providedIn: 'root',
})
export class AnalystService {
  private cache = new Map<string, any>();

  constructor(private api: ApiService) {}

  private checkCache<T>(key: string, fetchObs: Observable<T>): Observable<T> {
    if (this.cache.has(key)) {
      return of(this.cache.get(key));
    }
    return fetchObs.pipe(
      map((data) => {
        this.cache.set(key, data);
        return data;
      })
    );
  }

  // Clear cache if needed (e.g. on log out or force refresh)
  clearCache(): void {
    this.cache.clear();
  }

  getAssignedProjects(userId?: number): Observable<OutreachProject[]> {
    if (!userId) return of([]);
    const cacheKey = `projects_${userId}`;
    return this.checkCache(
      cacheKey,
      (this.api.get(`projects/user/${userId}`) as Observable<OutreachProject[]>).pipe(
        map((projects) =>
          (projects || []).filter(
            (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
          ),
        ),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) return of([]);
          return throwError(() => error);
        })
      )
    );
  }

  getProjectAssignments(projectId: number): Observable<{ states: any[], awcs: OutreachLocation[] }> {
    const cacheKey = `project_assignments_${projectId}`;
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/assigned-locations/${projectId}`) as Observable<any>).pipe(
        map((res) => {
          if (Array.isArray(res)) return { states: [], awcs: res };
          return {
            states: res?.states || [],
            awcs: res?.awcs || []
          };
        }),
        catchError(() => of({ states: [], awcs: [] }))
      )
    );
  }

  getBeneficiaries(search?: string, projectId?: number): Observable<Beneficiary[]> {
    const cacheKey = `beneficiaries_${search || ''}_${projectId || ''}`;
    const params: any = {};
    if (search) params.search = search;
    if (projectId) params.projectId = projectId;
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/beneficiary-list`, params) as Observable<Beneficiary[]>).pipe(
        map((rows) => rows || []),
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) return of([]);
          return throwError(() => error);
        })
      )
    );
  }

  getDashboardStats(
    projectId?: number,
    activityId?: number,
    sessionId?: number,
    adminId?: number,
    managerId?: number,
    workerId?: number,
    year?: string,
    month?: string,
    state?: string,
    district?: string,
    block?: string,
    awc?: string,
    unique?: boolean
  ): Observable<OutreachDashboardStats | any> {
    const params: any = {};
    if (projectId) params.projectId = projectId;
    if (activityId) params.activityId = activityId;
    if (sessionId) params.sessionId = sessionId;
    if (adminId) params.adminId = adminId;
    if (managerId) params.managerId = managerId;
    if (workerId) params.workerId = workerId;
    if (year) params.year = year;
    if (month) params.month = month;
    if (state) params.state = state;
    if (district) params.district = district;
    if (block) params.block = block;
    if (awc) params.awc = awc;
    if (unique !== undefined) params.unique = String(unique);
    
    const cacheKey = `dashboard_stats_${JSON.stringify(params)}`;
    return this.checkCache(
      cacheKey,
      this.api.get(`analyst/dashboard/stats`, params)
    );
  }

  getDynamicsReports(
    groupName: string,
    activityId?: number,
    sessionId?: number,
    adminId?: number,
    managerId?: number,
    workerId?: number,
    year?: string,
    month?: string,
    state?: string,
    district?: string,
    block?: string,
    awc?: string,
    unique?: boolean
  ): Observable<DynamicsTableRecord[]> {
    const params: any = { group: groupName };
    if (activityId) params.activityId = activityId;
    if (sessionId) params.sessionId = sessionId;
    if (adminId) params.adminId = adminId;
    if (managerId) params.managerId = managerId;
    if (workerId) params.workerId = workerId;
    if (year) params.year = year;
    if (month) params.month = month;
    if (state) params.state = state;
    if (district) params.district = district;
    if (block) params.block = block;
    if (awc) params.awc = awc;
    if (unique !== undefined) params.unique = String(unique);

    const cacheKey = `dynamics_reports_${JSON.stringify(params)}`;
    return this.checkCache(
      cacheKey,
      this.api.get<DynamicsTableRecord[]>(`analyst/dashboard/action-details`, params)
    );
  }

  getOutreachDynamicsReports(
    groupName: string,
    adminId?: number,
    managerId?: number,
    workerId?: number,
    state?: string,
    district?: string,
    block?: string,
    awc?: string,
  ): Observable<DynamicsTableRecord[]> {
    const params: any = { group: groupName };
    if (adminId) params.adminId = adminId;
    if (managerId) params.managerId = managerId;
    if (workerId) params.workerId = workerId;
    if (state) params.state = state;
    if (district) params.district = district;
    if (block) params.block = block;
    if (awc) params.awc = awc;

    const cacheKey = `outreach_dynamics_reports_${JSON.stringify(params)}`;
    return this.checkCache(
      cacheKey,
      this.api.get<DynamicsTableRecord[]>(`analyst/dashboard/outreach-dynamics-details`, params)
    );
  }

  getAnalystActivities(): Observable<OutreachActivity[]> {
    const cacheKey = 'activities';
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/dashboard/activities`) as Observable<OutreachActivity[]>).pipe(
        map((activities) =>
          (activities || []).filter(
            (a) => (a?.status ?? '').toString().toUpperCase() === 'ACTIVE',
          ),
        ),
        catchError(() => of([])),
      )
    );
  }

  getAnalystSessions(activityId: number): Observable<OutreachSession[]> {
    const cacheKey = `sessions_${activityId}`;
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/dashboard/activity/${activityId}/sessions`) as Observable<OutreachSession[]>).pipe(
        map((sessions) =>
          (sessions || []).filter(
            (s) => (s?.status ?? '').toString().toUpperCase() === 'ACTIVE',
          ),
        ),
        catchError(() => of([])),
      )
    );
  }

  getAnalystReports(): Observable<any[]> {
    const cacheKey = 'reports';
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/dashboard/reports`) as Observable<any[]>).pipe(
        map((rows) => rows || []),
        catchError(() => of([]))
      )
    );
  }

  getAnalystDashboardUsers(): Observable<{ admins: any[], managers: any[], workers: any[] }> {
    const cacheKey = 'dashboard_users';
    return this.checkCache(
      cacheKey,
      this.api.get<{ admins: any[], managers: any[], workers: any[] }>(`analyst/dashboard/users`)
    );
  }

  getBeneficiary(id: number): Observable<any> {
    const cacheKey = `beneficiary_${id}`;
    return this.checkCache(
      cacheKey,
      this.api.get(`analyst/beneficiary/${id}`)
    );
  }

  getFamilyMembers(beneficiaryId: number): Observable<any[]> {
    const cacheKey = `family_members_${beneficiaryId}`;
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/beneficiary/${beneficiaryId}/family-members`) as Observable<any[]>).pipe(
        catchError(() => of([]))
      )
    );
  }

  getReportsByBeneficiary(beneficiaryId: number): Observable<any[]> {
    const cacheKey = `reports_by_beneficiary_${beneficiaryId}`;
    return this.checkCache(
      cacheKey,
      (this.api.get(`analyst/beneficiary/${beneficiaryId}/reports`) as Observable<any[]>).pipe(
        catchError(() => of([]))
      )
    );
  }

  getProfile(): Observable<any> {
    return this.api.get('auth/me', undefined, { cache: 'reload' });
  }

  updateProfile(data: any): Observable<any> {
    return this.api.put('users/profile', data);
  }
}
