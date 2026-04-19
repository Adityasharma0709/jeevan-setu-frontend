import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../core/services/api';

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    mobileNumber?: string | null;
    mobile?: string;
    roles: string[];
}

export interface OutreachWorker {
    id: number;
    name: string;
    email: string;
    mobile?: string;
    mobileNumber?: string;
    usercode?: string;
    status: string;
    projectId?: number;
    locationId?: number;
    projects?: Array<{ id: number; name?: string }>;
    projectAssignments?: Array<{
        projectId: number;
        locationId: number;
        project?: { id: number; name?: string };
        location?: { id: number; village?: string; block?: string };
    }>;
}

export interface ManagerBeneficiaryProject {
    id: number;
    name?: string | null;
}

export interface ManagerBeneficiaryLocation {
    id: number;
    village?: string | null;
    block?: string | null;
    name?: string | null;
}

export interface ManagerBeneficiary {
    id: number;
    uid?: string | null;
    name: string;
    mobileNumber?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    guardianName?: string | null;
    religion?: string | null;
    caste?: string | null;
    qualification?: string | null;
    monthlyIncome?: number | null;
    primaryIncomeSource?: string | null;
    economicStatus?: string | null;
    employmentStatus?: string | null;
    maritalStatus?: string | null;
    dateOfMarriage?: string | null;
    womanAgeAtMarriage?: number | null;
    husbandAgeAtMarriage?: number | null;
    state?: string | null;
    district?: string | null;
    block?: string | null;
    village?: string | null;
    projectId?: number | null;
    locationId?: number | null;
    project?: ManagerBeneficiaryProject | null;
    location?: ManagerBeneficiaryLocation | null;
    createdBy?: {
        name?: string;
        email?: string;
        mobileNumber?: string;
    } | null;
    children?: any[];
    activities?: any[];
    groups?: any[];
    createdAt?: string;
    updatedAt?: string;
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

    getManagerDashboard(): Observable<any> {
        return this.api.get(`${this.endpoint}/dashboard/manager`);
    }

    getProfile(): Observable<UserProfile> {
        // Assuming /auth/me or similar exists, but following the pattern
        return this.api.get('auth/me', undefined, { cache: 'reload' }) as Observable<UserProfile>;
    }

    updateProfile(data: Partial<UserProfile>): Observable<UserProfile> {
        return this.api.put('users/profile', data) as Observable<UserProfile>;
    }

    getOutreachWorkers(): Observable<OutreachWorker[]> {
        return this.api.get(`${this.endpoint}/outreach-workers`) as Observable<OutreachWorker[]>;
    }

    getNextOutreachCode(): Observable<{ code: string }> {
        return this.api.get('users/next-code?role=OUTREACH', undefined, { cache: 'reload' }) as Observable<{ code: string }>;
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
        return (this.api.get(`locations?projectId=${projectId}`) as Observable<any[]>).pipe(
            map((locations) =>
                (locations || []).filter(
                    (l) => (l?.status ?? '').toString().toUpperCase() === 'ACTIVE',
                ),
            ),
        );
    }

    getAssignedLocations(projectId: number): Observable<any[]> {
        return this.api.get(`${this.endpoint}/projects/${projectId}/locations`) as Observable<any[]>;
    }

    tagOutreachWorkerProjectLocation(workerId: number, projectId: number, locationId: number): Observable<any> {
        return this.api.post(`${this.endpoint}/outreach-workers/${workerId}/tag`, { projectId, locationId });
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

    cancelRequest(id: number): Observable<any> {
        return this.api.delete(`${this.endpoint}/my-requests/${id}`);
    }

    updateRequestStatus(id: number, status: 'APPROVED' | 'REJECTED', reason?: string): Observable<any> {
        const payload: any = { status };
        if (reason) payload.reason = reason;
        return this.api.patch(`${this.endpoint}/profile-requests/${id}`, payload);
    }
    getBeneficiaries(): Observable<any[]> {
        return this.api.get(`${this.endpoint}/beneficiaries`) as Observable<ManagerBeneficiary[]>;
    }

    getBeneficiary(id: number): Observable<ManagerBeneficiary> {
        return this.api.get(`outreach/beneficiary/${id}`) as Observable<ManagerBeneficiary>;
    }
}
