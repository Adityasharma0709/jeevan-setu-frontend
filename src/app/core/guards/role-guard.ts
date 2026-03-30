import { CanActivateFn } from '@angular/router';
import { decodeJwtPayload } from '../utils/jwt';

export const roleGuard: CanActivateFn = (route, state) => {

  const token = localStorage.getItem('token');
  if (!token) return false;

  const payload = decodeJwtPayload<{ roles?: string[] }>(token);
  const userRoles = payload?.roles ?? [];

  const allowedRoles = route.data['roles'] as string[];

  return allowedRoles.some(r => userRoles.includes(r));
};
