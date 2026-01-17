import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class AuthService {

  getToken() {
    return localStorage.getItem('token');
  }
}
