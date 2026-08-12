import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { decodeJwtPayload } from '../utils/jwt';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const payload = decodeJwtPayload<{ exp?: number; roles?: string[] }>(token);
  
  // Check if token has expired
  if (payload?.exp && Date.now() >= payload.exp * 1000) {
    localStorage.clear();
    router.navigate(['/login']);
    return false;
  }

  const userRoles = payload?.roles ?? [];
  const allowedRoles = route.data['roles'] as string[];

  const isAllowed = allowedRoles.some(r => userRoles.includes(r));
  if (!isAllowed) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};
