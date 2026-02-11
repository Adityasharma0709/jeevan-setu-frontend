import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';

export interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
    status: string;
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
        // Ensuring the role is set to MANAGER
        return this.api.post(this.endpoint, { ...data, roles: ['MANAGER'] }) as Observable<User>;
    }

    /**
     * Update manager details
     */
    update(id: number, data: any): Observable<User> {
        return this.api.put(`${this.endpoint}/${id}`, data) as Observable<User>;
    }

    /**
     * Assign project and location to a user (Manager)
     */
    assignProject(userId: number, projectId: number, locationId: number): Observable<any> {
        return this.api.post('users/assign', {
            userId,
            projectId,
            locationId,
        });
    }

    /**
     * Get list of projects (for assignment dropdown)
     */
    getProjects(): Observable<any[]> {
        return this.api.get('projects') as Observable<any[]>;
    }

    /**
     * Get locations for a specific project (for assignment dropdown)
     */
    getLocations(projectId: number): Observable<any[]> {
        return this.api.get(`locations?projectId=${projectId}`) as Observable<any[]>;
    }
}
