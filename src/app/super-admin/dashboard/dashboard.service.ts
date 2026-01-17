import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private API = 'http://localhost:3000/users/dashboard';

  constructor(private http: HttpClient) {}

  getSuperAdminStats() {
    return this.http.get<any>(`${this.API}/super-admin`);
  }
}
