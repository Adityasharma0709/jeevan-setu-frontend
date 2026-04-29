import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../core/services/api';

export interface Activity {
    id: number;
    name: string;
    description?: string;
    projectId?: number;
    project?: {
        id: number;
        name: string;
        projectCode?: string;
    };
    status: string;
    creator?: {
        id: number;
        name?: string;
        email?: string;
    };
    createdBy?: {
        id: number;
        name?: string;
        email?: string;
    };
    createdById?: number;
}

export interface Group {
    id: number;
    name: string;
    minAge?: number;
    maxAge?: number;
    status: string;
    activities?: { activity: Activity }[];
    creator?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface Session {
    id: number;
    activityId: number;
    name: string;
    sessionDate?: string | Date;
    description?: string;
    status: string;
    activity?: {
        id: number;
        name: string;
    };
    creator?: {
        id: number;
        name?: string;
        email?: string;
    };
    createdBy?: {
        id: number;
        name?: string;
        email?: string;
    };
    createdById?: number;
}

@Injectable({
    providedIn: 'root',
})
export class AdminService {
    private readonly endpoint = 'admin';

    constructor(private api: ApiService) { }

    // Dashboard
    getAdminDashboard(): Observable<any> {
        return this.api.get(`${this.endpoint}/dashboard/admin`);
    }

    getAssignedProjects(userId?: number): Observable<any[]> {
        const url = userId ? `projects/user/${userId}` : 'projects';
        return (this.api.get(url) as Observable<any[]>).pipe(
            map((projects) =>
                (projects || []).filter(
                    (p) => (p?.status ?? '').toString().toUpperCase() === 'ACTIVE',
                ),
            ),
            catchError((error: HttpErrorResponse) => {
                if (error.status === 404) {
                    return of([]);
                }
                return throwError(() => error);
            })
        );
    }

    // Activities
    getActivities(): Observable<Activity[]> {
        return this.api.get(`${this.endpoint}/activities`) as Observable<Activity[]>;
    }

    createActivity(data: any): Observable<Activity> {
        return this.api.post(`${this.endpoint}/activities`, data) as Observable<Activity>;
    }

    updateActivity(id: number, data: any): Observable<Activity> {
        return this.api.put(`${this.endpoint}/activity/${id}`, data) as Observable<Activity>;
    }

    deactivateActivity(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/activity/${id}/deactivate`, {});
    }

    activateActivity(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/activity/${id}/activate`, {});
    }

    // Groups
    getGroups(): Observable<Group[]> {
        return this.api.get(`${this.endpoint}/groups`) as Observable<Group[]>;
    }

    createGroup(data: any): Observable<Group> {
        return this.api.post(`${this.endpoint}/groups`, data) as Observable<Group>;
    }

    updateGroup(id: number, data: any): Observable<Group> {
        return this.api.put(`${this.endpoint}/group/${id}`, data) as Observable<Group>;
    }

    deactivateGroup(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/group/${id}/deactivate`, {});
    }

    activateGroup(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/group/${id}/activate`, {});
    }

    tagGroupWithActivity(data: { groupId: number; activityId: number }): Observable<any> {
        return this.api.post(`${this.endpoint}/tag-group-activity`, data);
    }

    // Sessions
    createSession(data: any): Observable<Session> {
        return this.api.post(`${this.endpoint}/session`, data) as Observable<Session>;
    }

    updateSession(id: number, data: any): Observable<Session> {
        return this.api.put(`${this.endpoint}/session/${id}`, data) as Observable<Session>;
    }

    deactivateSession(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/session/${id}/deactivate`, {});
    }

    activateSession(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/session/${id}/activate`, {});
    }

    getSessionsByActivity(activityId: number): Observable<Session[]> {
        return this.api.get(`${this.endpoint}/activity/${activityId}/sessions`) as Observable<Session[]>;
    }

    getAllSessions(): Observable<Session[]> {
        return this.api.get(`${this.endpoint}/sessions`) as Observable<Session[]>;
    }

    getBeneficiaryRequests(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/beneficiary-requests`) as Observable<any[]>;
    }

    approveBeneficiaryRequest(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/beneficiary-requests/${id}/approve`, {});
    }

    rejectBeneficiaryRequest(id: number, reason?: string): Observable<any> {
        return this.api.patch(`${this.endpoint}/beneficiary-requests/${id}/reject`, { reason });
    }

    getAccountRequests(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/profile-requests`) as Observable<any[]>;
    }

    approveAccountRequest(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/profile-requests/${id}/approve`, {});
    }

    rejectAccountRequest(id: number, reason?: string): Observable<any> {
        return this.api.patch(`${this.endpoint}/profile-requests/${id}/reject`, { reason });
    }

    getStates(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/states`) as Observable<any[]>;
    }
}

