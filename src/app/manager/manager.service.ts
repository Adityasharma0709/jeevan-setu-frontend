import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../core/services/api';

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    roles: string[];
}

export interface OutreachWorker {
    id: number;
    name: string;
    email: string;
    status: string;
    projectId?: number;
    locationId?: number;
}

export interface AccountRequest {
    id: number;
    type: 'CREATE' | 'MODIFY' | 'DEACTIVATE';
    data: any;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

@Injectable({
    providedIn: 'root',
})
export class ManagerService {
    private readonly endpoint = 'manager';

    constructor(private api: ApiService) { }

    getProfile(): Observable<UserProfile> {
        // Assuming /auth/me or similar exists, but following the pattern
        return this.api.get('auth/me') as Observable<UserProfile>;
    }

    updateProfile(data: Partial<UserProfile>): Observable<UserProfile> {
        return this.api.put('users/profile', data) as Observable<UserProfile>;
    }

    getOutreachWorkers(): Observable<OutreachWorker[]> {
        return this.api.get(`${this.endpoint}/outreach-workers`) as Observable<OutreachWorker[]>;
    }

    getProjects(userId?: number): Observable<any[]> {
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

    getLocations(projectId: number): Observable<any[]> {
        return this.api.get(`locations?projectId=${projectId}`) as Observable<any[]>;
    }

    submitAccountRequest(type: string, data: any): Observable<any> {
        return this.api.post(`${this.endpoint}/account-requests`, { type, data });
    }

    requestBeneficiaryUpdate(beneficiaryId: number, changes: any): Observable<any> {
        return this.api.post(`${this.endpoint}/beneficiary/${beneficiaryId}/request-update`, changes);
    }

    getPendingRequests(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/profile-requests`) as Observable<any[]>;
    }

    getBeneficiaryRequests(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/beneficiary-requests`) as Observable<any[]>;
    }

    approveBeneficiaryRequest(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/request/${id}/approve`, {});
    }

    rejectBeneficiaryRequest(id: number, reason?: string): Observable<any> {
        return this.api.patch(`${this.endpoint}/request/${id}/reject`, { reason });
    }

    getMyRequests(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/my-requests`) as Observable<any[]>;
    }

    updateRequestStatus(id: number, status: 'APPROVED' | 'REJECTED', reason?: string): Observable<any> {
        const payload: any = { status };
        if (reason) payload.reason = reason;
        return this.api.patch(`${this.endpoint}/profile-requests/${id}`, payload);
    }
    getBeneficiaries(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/beneficiaries`) as Observable<any[]>;
    }
}
