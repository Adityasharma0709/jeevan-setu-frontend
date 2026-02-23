import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class AuthService {

  getToken() {
    return localStorage.getItem('token');
  }

  getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (e) {
      return null;
    }
  }
}
