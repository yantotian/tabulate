import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../core/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  const token = localStorage.getItem('tabulator_pro_token');
  if (token && auth.user()) return true;
  router.navigate(['/login']);
  return false;
};

export const headGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isHead()) return true;
  router.navigate(['/app/setup']);
  return false;
};

export const tabulatorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isTabulator()) return true;
  router.navigate(['/app/judge']);
  return false;
};

export const judgeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isJudge()) return true;
  router.navigate(['/app/setup']);
  return false;
};
