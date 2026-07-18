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
  constructor(private api: ApiService) {}

  getAssignedProjects(userId?: number): Observable<OutreachProject[]> {
    if (!userId) return of([]);
    return (this.api.get(`projects/user/${userId}`) as Observable<OutreachProject[]>).pipe(
      map((projects) =>
        (projects || []).filter(
          (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) return of([]);
        return throwError(() => error);
      })
    );
  }

  getProjectAssignments(projectId: number): Observable<{ states: any[], awcs: OutreachLocation[] }> {
    return (this.api.get(`outreach/assigned-locations/${projectId}`) as Observable<any>).pipe(
      map((res) => {
        if (Array.isArray(res)) return { states: [], awcs: res };
        return {
          states: res?.states || [],
          awcs: res?.awcs || []
        };
      }),
      catchError(() => of({ states: [], awcs: [] }))
    );
  }

  getBeneficiaries(search?: string, projectId?: number): Observable<Beneficiary[]> {
    const params: any = {};
    if (search) params.search = search;
    if (projectId) params.projectId = projectId;
    return (this.api.get(`outreach/beneficiary-list`, params) as Observable<Beneficiary[]>).pipe(
      map((rows) => rows || []),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) return of([]);
        return throwError(() => error);
      })
    );
  }

  getDashboardStats(
    projectId?: number,
    activityId?: number,
    sessionId?: number,
    adminId?: number,
    managerId?: number,
    workerId?: number
  ): Observable<OutreachDashboardStats | any> {
    const params: any = {};
    if (projectId) params.projectId = projectId;
    if (activityId) params.activityId = activityId;
    if (sessionId) params.sessionId = sessionId;
    if (adminId) params.adminId = adminId;
    if (managerId) params.managerId = managerId;
    if (workerId) params.workerId = workerId;
    return this.api.get(`users/analyst/dashboard/stats`, params);
  }

  getDynamicsReports(
    groupName: string,
    activityId?: number,
    sessionId?: number,
    adminId?: number,
    managerId?: number,
    workerId?: number
  ): Observable<DynamicsTableRecord[]> {
    const params: any = { group: groupName };
    if (activityId) params.activityId = activityId;
    if (sessionId) params.sessionId = sessionId;
    if (adminId) params.adminId = adminId;
    if (managerId) params.managerId = managerId;
    if (workerId) params.workerId = workerId;
    return this.api.get<DynamicsTableRecord[]>(`users/analyst/dashboard/action-details`, params);
  }

  getAnalystActivities(): Observable<OutreachActivity[]> {
    return (this.api.get(`users/analyst/dashboard/activities`) as Observable<OutreachActivity[]>).pipe(
      map((activities) =>
        (activities || []).filter(
          (a) => (a?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([])),
    );
  }

  getAnalystSessions(activityId: number): Observable<OutreachSession[]> {
    return (this.api.get(`users/analyst/dashboard/activity/${activityId}/sessions`) as Observable<OutreachSession[]>).pipe(
      map((sessions) =>
        (sessions || []).filter(
          (s) => (s?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([])),
    );
  }

  getAnalystReports(): Observable<any[]> {
    return (this.api.get(`users/analyst/dashboard/reports`) as Observable<any[]>).pipe(
      map((rows) => rows || []),
      catchError(() => of([]))
    );
  }

  getAnalystDashboardUsers(): Observable<{ admins: any[], managers: any[], workers: any[] }> {
    return this.api.get<{ admins: any[], managers: any[], workers: any[] }>(`users/analyst/dashboard/users`);
  }
}
