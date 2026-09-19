import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AppState, Contest } from '../models/app-state.model';
import { tap, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StateService {
  private api = inject(ApiService);
  private defaultState: AppState = {
    tabulators: [{ id: 'tab_head', username: 'admin', name: 'Admin / Head Tabulator', password: 'Bayugan123', isHead: true }],
    activeContestId: 'contest_cooking',
    auditLogs: [],
    contests: []
  };
  state = signal<AppState | null>(null);
  loading = signal(false);

  get activeContest(): Contest | null {
    const s = this.state();
    if (!s) return null;
    const userRaw = localStorage.getItem('tabulator_pro_session');
    let user: any = null; try { user = userRaw ? JSON.parse(userRaw) : null; } catch {}
    // Try activeContestId first
    let c: Contest | null | undefined = s.contests.find(x => x.id === s.activeContestId);
    if (c) {
      // check access if tabulator
      if (user && user.role !== 'judge' && !user.isHead) {
        const has = String(c.createdByTabulatorId) === String(user.tabulatorId) || (c.assignedTabulatorIds || []).includes(user.tabulatorId);
        if (!has) {
          const auth = s.contests.filter(cc => String(cc.createdByTabulatorId) === String(user.tabulatorId) || (cc.assignedTabulatorIds || []).includes(user.tabulatorId));
          if (auth.length) c = auth[0];
        }
      }
      if (user?.role === 'judge' && String(c!.id) !== String(user.contestId)) {
        const fetched: Contest | undefined = s.contests.find(x => String(x.id) === String(user.contestId));
        c = fetched ?? null;
      }
      return c || null;
    }
    return s.contests[0] || null;
  }

  normalize(state: any): AppState {
    if (!state) return JSON.parse(JSON.stringify(this.defaultState));
    if (!Array.isArray(state.tabulators) || state.tabulators.length === 0) state.tabulators = JSON.parse(JSON.stringify(this.defaultState.tabulators));
    if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
    if (!Array.isArray(state.contests)) state.contests = [];
    if ((state as any)._schemaVersion === undefined) (state as any)._schemaVersion = 1;
    const needsMigration = (state as any)._schemaVersion < 2;
    state.contests.forEach((c: any) => {
      if (!c.createdByTabulatorId) c.createdByTabulatorId = 'tab_head';
      if (!c.createdByName) c.createdByName = 'Admin / Head Tabulator';
      if (!Array.isArray(c.assignedTabulatorIds)) c.assignedTabulatorIds = [];
      if (!Array.isArray(c.penalties)) c.penalties = [];
      if (!Array.isArray(c.criteria)) c.criteria = [];
      if (!c.scores) c.scores = {};
      Object.keys(c.scores).forEach(jid => {
        Object.keys(c.scores[jid] || {}).forEach(cid => {
          const e = c.scores[jid][cid];
          if (e && !Array.isArray(e.penalties)) e.penalties = [];
          if (e && e.penalty === undefined) e.penalty = 0;
        });
      });
    });
    // client-side migration mirror (auto-scale raw>weight → raw*weight/100)
    if (needsMigration) {
      state.contests.forEach((c: any) => {
        Object.keys(c.scores || {}).forEach(jid => {
          Object.keys(c.scores[jid] || {}).forEach(cid => {
            const entry = c.scores[jid][cid];
            if (!entry?.criteria) return;
            Object.keys(entry.criteria).forEach(critId => {
              const raw = parseFloat(entry.criteria[critId]);
              if (isNaN(raw)) return;
              const crit = c.criteria.find((x: any) => String(x.id) === String(critId));
              const w = crit ? parseFloat(crit.weight) || 0 : 100;
              if (raw > w) entry.criteria[critId] = Math.round((raw * w / 100) * 100) / 100;
            });
          });
        });
      });
      (state as any)._schemaVersion = 2;
    }
    if (!state.tabulators.some((t: any) => t.isHead)) state.tabulators[0].isHead = true;
    if (!state.activeContestId && state.contests.length) state.activeContestId = state.contests[0].id;
    return state as AppState;
  }

  loadFromBackend() {
    this.loading.set(true);
    return this.api.getState().pipe(
      tap((res: any) => {
        if (res?.state) {
          const norm = this.normalize(res.state);
          this.state.set(norm);
        }
        this.loading.set(false);
      }),
      catchError(() => { this.loading.set(false); return of(null); })
    );
  }

  setActiveContest(id: string) {
    const s = this.state();
    if (!s) return;
    s.activeContestId = id;
    localStorage.setItem('tabulator_pro_active_contest', id);
    this.state.set({ ...s });
  }

  refreshContests() {
    return this.api.getContests().pipe(tap((contests: any) => {
      const s = this.state();
      if (s) {
        s.contests = contests;
        if (!contests.some((c: any) => c.id === s.activeContestId) && contests.length) s.activeContestId = contests[0].id;
        this.state.set({ ...s });
      } else {
        this.state.set(this.normalize({ contests, activeContestId: contests[0]?.id, tabulators: this.defaultState.tabulators, auditLogs: [] }));
      }
    }));
  }
}
