import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  public baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  post(url: string, data: any) {
    return this.http.post(`${this.baseUrl}/${url}`, data);
  }
  get(url: string, params?: any) {
    return this.http.get(`${this.baseUrl}/${url}`, { params });
  }

  // PUT
  put(url: string, data: any) {
    return this.http.put(`${this.baseUrl}/${url}`, data);
  }

  // PATCH
  patch(url: string, data: any) {
    return this.http.patch(`${this.baseUrl}/${url}`, data);
  }

  // DELETE
  delete(url: string) {
    return this.http.delete(`${this.baseUrl}/${url}`);
  }
}

export class Api { }
