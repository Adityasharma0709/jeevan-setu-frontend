import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient, private api: ApiService) { }

  getSuperAdminStats() {
    return this.http.get<any>(`${this.api.baseUrl}/users/dashboard/super-admin`);
  }
}
