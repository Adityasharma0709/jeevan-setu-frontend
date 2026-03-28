import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api';

export interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
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

@Injectable({
    providedIn: 'root',
})
export class ManagersService {
    private readonly endpoint = 'users';

    constructor(private api: ApiService) { }

    /**
     * Get all managers with optional search
     */
    findAll(search?: string): Observable<User[]> {
        const query = search ? `?search=${encodeURIComponent(search)}&role=MANAGER` : '?role=MANAGER';
        return this.api.get(`${this.endpoint}${query}`) as Observable<User[]>;
    }

    /**
     * Create a new manager
     */
    create(data: any): Observable<User> {
        return this.api.post(`${this.endpoint}/create-manager`, data) as Observable<User>;
    }

    /**
     * Update manager details
     */
    update(id: number, data: any): Observable<User> {
        return this.api.put(`${this.endpoint}/manager/${id}`, data) as Observable<User>;
    }

    /**
     * Toggle manager status
     */
    updateStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Observable<User> {
        return this.api.put(`${this.endpoint}/manager/${id}`, { status }) as Observable<User>;
    }

    /**
     * Assign project and location to a user (Manager)
     */
    assignProject(userId: number, projectId: number, locationId: number): Observable<any> {
        return this.api.post(`${this.endpoint}/assign-project-location`, {
            userId,
            projectId,
            locationId,
        });
    }

    /**
     * Get list of projects (optionally filtered by assigned user)
     */
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

    /**
     * Get locations for a specific project (for assignment dropdown)
     */
    getLocations(projectId: number): Observable<any[]> {
        return this.api.get(`locations?projectId=${projectId}`) as Observable<any[]>;
    }
}
