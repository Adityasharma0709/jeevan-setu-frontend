import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiGetOptions, ApiService } from '../../core/services/api';

export interface User {
    id: number;
    usercode?: string;
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
    createdByAdminId?: number;
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
    findAll(search?: string, options?: ApiGetOptions): Observable<User[]> {
        const query = search ? `?search=${encodeURIComponent(search)}&role=MANAGER` : '?role=MANAGER';
        return (this.api.get(`${this.endpoint}${query}`, undefined, options) as Observable<any>).pipe(
            map((response) => this.normalizeUsersResponse(response)),
        );
    }

    getNextManagerCode(): Observable<{ code: string }> {
        return this.api.get('users/next-code?role=MANAGER', undefined, { cache: 'reload' }) as Observable<{ code: string }>;
    }

    private normalizeUsersResponse(response: any): User[] {
        if (Array.isArray(response)) return response as User[];

        const candidates = [
            response?.data,
            response?.items,
            response?.results,
            response?.users,
            response?.rows,
            response?.data?.data,
            response?.data?.items,
            response?.data?.results,
            response?.data?.users,
            response?.data?.rows,
            response?.payload,
            response?.payload?.data,
            response?.payload?.items,
            response?.payload?.results,
        ];

        for (const value of candidates) {
            if (Array.isArray(value)) return value as User[];
        }

        const deepMatch = this.findFirstArrayByKeysDeep(response, [
            'usercode',
            'userCode',
            'user_code',
            'accountCode',
            'account_code',
            'email',
            'name',
        ]);
        return deepMatch;
    }

    private findFirstArrayByKeysDeep(source: unknown, keys: string[], maxDepth = 5): User[] {
        if (!source || typeof source !== 'object') return [];

        const visited = new WeakSet<object>();
        const queue: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];

        const hasAnyKey = (value: any) =>
            keys.some((key) => value?.[key] !== null && value?.[key] !== undefined);

        while (queue.length) {
            const { value, depth } = queue.shift()!;
            if (!value || typeof value !== 'object') continue;

            const obj = value as object;
            if (visited.has(obj)) continue;
            visited.add(obj);

            if (Array.isArray(value)) {
                if (value.some((item) => item && typeof item === 'object' && hasAnyKey(item))) {
                    return value as User[];
                }
                if (depth < maxDepth) {
                    for (const item of value) queue.push({ value: item, depth: depth + 1 });
                }
                continue;
            }

            if (depth >= maxDepth) continue;

            for (const child of Object.values(value as Record<string, unknown>)) {
                if (child && typeof child === 'object') {
                    queue.push({ value: child, depth: depth + 1 });
                }
            }
        }

        return [];
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
        return (this.api.get(`locations?projectId=${projectId}`) as Observable<any[]>).pipe(
            map((locations) =>
                (locations || []).filter((l: any) => {
                    const raw = l?.status;
                    if (raw == null) return true;
                    return raw.toString().toUpperCase() === 'ACTIVE';
                }),
            ),
            catchError((error: HttpErrorResponse) => {
                if (error.status === 404) {
                    return of([]);
                }
                return throwError(() => error);
            }),
        );
    }
}
