import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { tap, catchError, of } from 'rxjs';

const TOKEN_KEY = 'tabulator_pro_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  user = signal<any | null>(this.loadUser());
  token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  isLoggedIn = computed(() => !!this.user() && !!this.token());
  isHead = computed(() => !!this.user()?.isHead);
  isTabulator = computed(() => this.user()?.role === 'tabulator');
  isJudge = computed(() => this.user()?.role === 'judge');

  private loadUser(): any | null {
    try {
      const raw = localStorage.getItem('tabulator_pro_session');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  private saveSession(user: any, token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('tabulator_pro_session', JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }
  getToken() { return localStorage.getItem(TOKEN_KEY); }

  loginTabulator(tabulatorId: string, username: string, password: string) {
    return this.api.loginTabulator({ role: 'tabulator', tabulatorId, username, password }).pipe(
      tap((res: any) => {
        const u = { role: 'tabulator', tabulatorId: res.user.tabulatorId, username: res.user.username, name: res.user.name, isHead: !!res.user.isHead };
        this.saveSession(u, res.token);
      })
    );
  }
  loginJudge(contestId: string, judgeId: string | number, password: string) {
    return this.api.loginJudge({ role: 'judge', contestId, judgeId, password }).pipe(
      tap((res: any) => {
        const u = { role: 'judge', contestId: res.user.contestId, judgeId: res.user.judgeId, name: res.user.name };
        this.saveSession(u, res.token);
        localStorage.setItem('tabulator_pro_active_contest', String(res.user.contestId));
      })
    );
  }
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('tabulator_pro_session');
    this.token.set(null);
    this.user.set(null);
  }
  verifyMe() {
    return this.api.me().pipe(
      tap((res: any) => {
        // Keep session synced
        const u = this.user();
        if (u && res?.user) {
          // merge
          const merged = { ...u, ...res.user };
          localStorage.setItem('tabulator_pro_session', JSON.stringify(merged));
          this.user.set(merged);
        }
      }),
      catchError(() => { this.logout(); return of(null); })
    );
  }
}
