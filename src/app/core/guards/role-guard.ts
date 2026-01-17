import { CanActivateFn } from '@angular/router';

export const roleGuard: CanActivateFn = (route, state) => {

  const token = localStorage.getItem('token');
  if (!token) return false;

  const payload = JSON.parse(atob(token.split('.')[1]));
  const userRoles = payload.roles;

  const allowedRoles = route.data['roles'] as string[];

  return allowedRoles.some(r => userRoles.includes(r));
};
