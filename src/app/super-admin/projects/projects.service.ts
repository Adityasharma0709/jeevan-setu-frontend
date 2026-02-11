import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';

export interface Project {
    id: number;
    projectCode: string;
    name: string;
    status: string;
    description?: string;
}

@Injectable({
    providedIn: 'root',
})
export class ProjectsService {
    private readonly endpoint = 'projects';

    constructor(private api: ApiService) { }

    /**
     * Get all projects with optional search
     */
    findAll(search?: string): Observable<Project[]> {
        const url = search ? `${this.endpoint}?search=${encodeURIComponent(search)}` : this.endpoint;
        return this.api.get(url) as Observable<Project[]>;
    }

    /**
     * Get project by ID
     */
    findOne(id: number): Observable<Project> {
        return this.api.get(`${this.endpoint}/${id}`) as Observable<Project>;
    }

    /**
     * Create a new project
     */
    create(dto: Partial<Project>): Observable<Project> {
        return this.api.post(this.endpoint, dto) as Observable<Project>;
    }

    /**
     * Update an existing project
     */
    update(id: number, dto: Partial<Project>): Observable<Project> {
        return this.api.put(`${this.endpoint}/${id}`, dto) as Observable<Project>;
    }

    /**
     * Update project status (ACTIVE/INACTIVE)
     */
    updateStatus(id: number, status: string): Observable<any> {
        return this.api.patch(`${this.endpoint}/${id}/status`, { status });
    }

    /**
     * Disable project (soft delete)
     */
    disable(id: number): Observable<any> {
        return this.api.patch(`${this.endpoint}/${id}/disable`, {});
    }

    /**
     * Get projects assigned to a specific user
     */
    findAssignedToUser(userId: number): Observable<Project[]> {
        return this.api.get(`${this.endpoint}/user/${userId}`) as Observable<Project[]>;
    }
}
