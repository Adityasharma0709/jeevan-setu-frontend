import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  post(url: string, data: any) {
    return this.http.post(`${this.baseUrl}/${url}`, data);
  }
  get(url: string) {
    return this.http.get(`${this.baseUrl}/${url}`);
  }

  // PUT
  put(url: string, data: any) {
    return this.http.put(`${this.baseUrl}/${url}`, data);
  }

  // PATCH
  patch(url: string, data: any) {
    return this.http.patch(`${this.baseUrl}/${url}`, data);
  }
}

export class Api {}
