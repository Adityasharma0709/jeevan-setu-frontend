import { Injectable } from "@angular/core";
import { decodeJwtPayload } from "../utils/jwt";

@Injectable({ providedIn: 'root' })
export class AuthService {

  getToken() {
    return localStorage.getItem('token');
  }

  getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;
    return decodeJwtPayload(token);
  }
}
