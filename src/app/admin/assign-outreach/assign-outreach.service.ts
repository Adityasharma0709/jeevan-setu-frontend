import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  usercode?: string;
  status: string;
  createdByAdminId?: number;
  createdByAdmin?: {
    id: number;
    name: string;
    email: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AssignOutreachService {
  constructor(private api: ApiService) {}

  getOutreachWorkers(): Observable<UserSummary[]> {
    return this.api.get('users?role=OUTREACH') as Observable<UserSummary[]>;
  }

  getManagers(): Observable<UserSummary[]> {
    return this.api.get('users?role=MANAGER') as Observable<UserSummary[]>;
  }

  assignManager(outreachId: number, managerId: number): Observable<any> {
    return this.api.patch(`users/outreach/${outreachId}/assign-manager`, { managerId });
  }
}
