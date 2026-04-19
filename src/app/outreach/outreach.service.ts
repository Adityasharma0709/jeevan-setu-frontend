import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import { ApiService } from '../core/services/api';

export interface OutreachProject {
  id: number;
  name: string;
  projectCode: string;
  status?: string;
}

export interface OutreachLocation {
  id: number;
  projectId: number;
  locationCode: string;
  state: string;
  district: string;
  block: string;
  village: string;
  status?: string;
}

export interface Beneficiary {
  id: number;
  uid: string;
  projectId: number;
  locationId: number;
  mobileNumber: string;
  name: string;
  gender: string;
  guardianName: string;
  dateOfBirth: string;
  maritalStatus?: string | null;
  dateOfMarriage?: string | null;
  womanAgeAtMarriage?: number | null;
  husbandAgeAtMarriage?: number | null;
  qualification: string;
  religion: string;
  caste: string;
  monthlyIncome: number;
  economicStatus: string;
  primaryIncomeSource: string;
  employmentStatus: string;
  children?: any[];
  activities?: any[];
  groups?: any[];
  /** Beneficiary's actual address — may differ from the project location */
  state?: string | null;
  district?: string | null;
  block?: string | null;
  village?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: OutreachProject;
  location?: OutreachLocation;
  createdBy?: {
    name: string;
    email: string;
  };
}

export interface CreateBeneficiaryPayload {
  projectId: number;
  locationId: number;
  mobileNumber: string;
  name: string;
  gender: string;
  guardianName: string;
  dateOfBirth: string;
  maritalStatus?: string;
  dateOfMarriage?: string;
  womanAgeAtMarriage?: number;
  husbandAgeAtMarriage?: number;
  qualification: string;
  religion: string;
  caste: string;
  monthlyIncome: number;
  economicStatus: string;
  primaryIncomeSource: string;
  employmentStatus: string;
  /** Beneficiary's actual address — may differ from the project location */
  state?: string;
  district?: string;
  block?: string;
  village?: string;
}

export interface OutreachActivity {
  id: number;
  name: string;
  description?: string;
  projectId?: number | null;
  status: string;
}

export interface BeneficiaryGroup {
  id: number;
  name: string;
  status?: string;
}

export interface OutreachSession {
  id: number;
  activityId: number;
  name: string;
  status: string;
}

export interface CreateReportPayload {
  beneficiaryId: number;
  activityId: number;
  sessionId?: number;
  sessionDate: string;
  reportData: Record<string, unknown>;
}

export interface OutreachDashboardStats {
  totalBeneficiaries: number;
  assignedProjects: number;
  assignedLocations: number;
}

@Injectable({
  providedIn: 'root',
})
export class OutreachService {
  private readonly endpoint = 'outreach';

  constructor(private api: ApiService) { }

  getProfile(): Observable<any> {
    return this.api.get('auth/me');
  }

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

  getLocationsByProject(projectId: number): Observable<OutreachLocation[]> {
    return (this.api.get(`${this.endpoint}/assigned-locations/${projectId}`) as Observable<OutreachLocation[]>).pipe(
      map((rows) =>
        (rows || []).filter(
          (l) => (l?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([]))
    );
  }

  getBeneficiaries(search?: string): Observable<Beneficiary[]> {
    return (this.api.get(`${this.endpoint}/beneficiary-list`, search ? { search } : {}) as Observable<Beneficiary[]>).pipe(
      map((rows) => rows || []),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) return of([]);
        return throwError(() => error);
      })
    );
  }

  getBeneficiary(id: number): Observable<Beneficiary> {
    return this.api.get(`${this.endpoint}/beneficiary/${id}`) as Observable<Beneficiary>;
  }

  createBeneficiary(data: CreateBeneficiaryPayload): Observable<Beneficiary> {
    return this.api.post(`${this.endpoint}/beneficiary`, data) as Observable<Beneficiary>;
  }

  raiseRequest(type: string, data: any): Observable<any> {
    return this.api.post(`${this.endpoint}/request`, { type, data });
  }

  requestBeneficiaryUpdate(id: number, changes: Record<string, unknown>): Observable<any> {
    return this.api.post(`${this.endpoint}/beneficiary/${id}/request-update`, { changes });
  }

  getMyRequests(): Observable<any[]> {
    return this.api.get(`${this.endpoint}/my-requests`) as Observable<any[]>;
  }


  getActiveActivities(): Observable<OutreachActivity[]> {
    return (this.api.get('admin/activities/active') as Observable<OutreachActivity[]>).pipe(
      map((rows) => rows || []),
      catchError(() => of([]))
    );
  }

  getSessionsByActivity(activityId: number): Observable<OutreachSession[]> {
    return (this.api.get(`admin/activity/${activityId}/sessions`) as Observable<OutreachSession[]>).pipe(
      map((rows) => rows || []),
      catchError(() => of([]))
    );
  }

  submitReport(data: CreateReportPayload): Observable<any> {
    return this.api.post(`${this.endpoint}/activity-report`, data);
  }

  getReportById(id: number): Observable<any> {
    return this.api.get(`${this.endpoint}/activity-report/${id}`);
  }

  updateReport(id: number, data: Partial<CreateReportPayload>): Observable<any> {
    return this.api.patch(`${this.endpoint}/activity-report/${id}`, data);
  }

  cancelRequest(requestId: number): Observable<any> {
    return this.api.delete(`${this.endpoint}/my-requests/${requestId}`);
  }

  getDashboardStats(userId?: number): Observable<OutreachDashboardStats> {
    return this.getAssignedProjects(userId).pipe(
      switchMap((projects) => {
        if (!projects.length) {
          return this.getBeneficiaries().pipe(
            map((beneficiaries) => ({
              totalBeneficiaries: beneficiaries.length,
              assignedProjects: 0,
              assignedLocations: 0,
            }))
          );
        }

        const locationCalls = projects.map((project) => this.getLocationsByProject(project.id));

        return forkJoin({
          beneficiaries: this.getBeneficiaries(),
          locationsByProject: forkJoin(locationCalls),
        }).pipe(
          map(({ beneficiaries, locationsByProject }) => {
            const uniqueLocationIds = new Set(
              locationsByProject.flat().map((location) => Number(location.id))
            );

            return {
              totalBeneficiaries: beneficiaries.length,
              assignedProjects: projects.length,
              assignedLocations: uniqueLocationIds.size,
            };
          })
        );
      })
    );
  }

  // Tagging
  tagBeneficiaryGroup(id: number, groupId: number): Observable<any> {
    return this.api.post(`${this.endpoint}/beneficiary/${id}/tag-group`, { groupId });
  }

  tagBeneficiaryActivity(id: number, activityId: number, sessionId: number): Observable<any> {
    return this.api.post(`${this.endpoint}/beneficiary/${id}/tag-activity`, { activityId, sessionId });
  }

  getGroups(): Observable<BeneficiaryGroup[]> {
    return (this.api.get(`${this.endpoint}/groups`) as Observable<BeneficiaryGroup[]>).pipe(
      map((groups) =>
        (groups || []).filter(
          (g) => (g?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([])),
    );
  }

  // Reuse existing getActiveActivities if possible, or use the new endpoint
  // getActiveActivities calls 'admin/activities/active'.
  // The new endpoint is 'outreach/activities'.
  getOutreachActivities(): Observable<OutreachActivity[]> {
    return (this.api.get(`${this.endpoint}/activities`) as Observable<OutreachActivity[]>).pipe(
      map((activities) =>
        (activities || []).filter(
          (a) => (a?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([])),
    );
  }

  getSessions(activityId: number): Observable<OutreachSession[]> {
    return (this.api.get(`${this.endpoint}/activity/${activityId}/sessions`) as Observable<OutreachSession[]>).pipe(
      map((sessions) =>
        (sessions || []).filter(
          (s) => (s?.status ?? '').toString().toUpperCase() === 'ACTIVE',
        ),
      ),
      catchError(() => of([])),
    );
  }

  getMyReports(): Observable<any[]> {
    return (this.api.get(`${this.endpoint}/my-reports`) as Observable<any[]>).pipe(
      map(reports => reports || []),
      catchError(() => of([]))
    );
  }
}
