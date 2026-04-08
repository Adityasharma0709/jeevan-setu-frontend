import { Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { Project } from '../projects/projects.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) { }

  getSuperAdminStats() {
    const baseStats$ = (this.api.get('users/dashboard/super-admin') as Observable<any>).pipe(
      catchError(() => of({}))
    );
    const admins$ = (this.api.get('users/admins') as Observable<any[]>).pipe(
      catchError(() => of([]))
    );
    const managers$ = (this.api.get('users?role=MANAGER') as Observable<any[]>).pipe(
      catchError(() => of([]))
    );
    const outreach$ = (this.api.get('users?role=OUTREACH') as Observable<any[]>).pipe(
      catchError(() => of([]))
    );

    return forkJoin({
      base: baseStats$,
      admins: admins$,
      managers: managers$,
      outreach: outreach$,
    }).pipe(
      map(({ base, admins, managers, outreach }) => ({
        ...(base || {}),
        totalAdmins: Array.isArray(admins) ? admins.length : 0,
        totalManagers: Array.isArray(managers) ? managers.length : 0,
        totalOutreach: Array.isArray(outreach) ? outreach.length : 0,
      }))
    );
  }

  getRecentProjects(limit = 10): Observable<Project[]> {
    return this.getProjectsSortedByRecent().pipe(map((projects) => projects.slice(0, limit)));
  }

  getProjectsSortedByRecent(): Observable<Project[]> {
    return (this.api.get('projects') as Observable<Project[]>).pipe(
      map((projects) =>
        [...(projects || [])].sort(
          (a, b) => this.getProjectSortTime(b) - this.getProjectSortTime(a)
        )
      )
    );
  }

  private getProjectSortTime(project: Project): number {
    const createdAt =
      (project as any)?.createdAt ?? (project as any)?.created_at ?? (project as any)?.createdOn;
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (!Number.isNaN(t)) return t;
    }

    const id = (project as any)?.id;
    return typeof id === 'number' ? id : 0;
  }
}
