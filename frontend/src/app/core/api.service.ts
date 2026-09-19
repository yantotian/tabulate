import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PublicContest, Contest, Tabulator, AuditLog } from '../models/app-state.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  health() { return this.http.get<any>('/api/health'); }
  publicContests(): Observable<PublicContest[]> { return this.http.get<PublicContest[]>('/api/public/contests'); }

  loginTabulator(payload: { role: 'tabulator'; tabulatorId?: string; username?: string; password: string }) {
    return this.http.post<{ token: string; user: any }>('/api/auth/login', payload);
  }
  loginJudge(payload: { role: 'judge'; contestId: string; judgeId: string | number; password: string }) {
    return this.http.post<{ token: string; user: any }>('/api/auth/login', payload);
  }
  me() { return this.http.get<{ user: any }>('/api/auth/me'); }

  getState() { return this.http.get<{ exists: boolean; state: any }>('/api/state'); }
  postState(state: any) { return this.http.post('/api/state', state); }

  getContests() { return this.http.get<Contest[]>('/api/contests'); }
  createContest(title: string, template: string) { return this.http.post<Contest>('/api/contests', { title, template }); }
  getContest(id: string) { return this.http.get<Contest>(`/api/contests/${id}`); }
  updateContest(id: string, title: string) { return this.http.put<Contest>(`/api/contests/${id}`, { title }); }
  deleteContest(id: string) { return this.http.delete(`/api/contests/${id}`); }

  addCriterion(contestId: string, name: string, weight: number) { return this.http.post(`/api/contests/${contestId}/criteria`, { name, weight }); }
  updateCriterion(contestId: string, cid: number | string, data: any) { return this.http.put(`/api/contests/${contestId}/criteria/${cid}`, data); }
  deleteCriterion(contestId: string, cid: number | string) { return this.http.delete(`/api/contests/${contestId}/criteria/${cid}`); }

  addPenalty(contestId: string, name: string, defaultDeduction: number) { return this.http.post(`/api/contests/${contestId}/penalties`, { name, defaultDeduction }); }
  updatePenalty(contestId: string, pid: number | string, data: any) { return this.http.put(`/api/contests/${contestId}/penalties/${pid}`, data); }
  deletePenalty(contestId: string, pid: number | string) { return this.http.delete(`/api/contests/${contestId}/penalties/${pid}`); }

  addContestant(contestId: string, name: string) { return this.http.post(`/api/contests/${contestId}/contestants`, { name }); }
  updateContestant(contestId: string, cid: number | string, name: string) { return this.http.put(`/api/contests/${contestId}/contestants/${cid}`, { name }); }
  deleteContestant(contestId: string, cid: number | string) { return this.http.delete(`/api/contests/${contestId}/contestants/${cid}`); }

  addJudge(contestId: string, name: string, password?: string) { return this.http.post(`/api/contests/${contestId}/judges`, { name, password }); }
  updateJudge(contestId: string, jid: number | string, data: any) { return this.http.put(`/api/contests/${contestId}/judges/${jid}`, data); }
  deleteJudge(contestId: string, jid: number | string) { return this.http.delete(`/api/contests/${contestId}/judges/${jid}`); }

  getScores(contestId: string, judgeId?: string | number) {
    const qs = judgeId ? `?judgeId=${judgeId}` : '';
    return this.http.get<any>(`/api/contests/${contestId}/scores${qs}`);
  }
  putScore(contestId: string, payload: { judgeId: string | number; contestantId: string | number; criteria?: Record<string, number>; penalties?: (string | number)[] }) {
    return this.http.put(`/api/contests/${contestId}/scores`, payload);
  }
  getLeaderboard(contestId: string) { return this.http.get<any>(`/api/contests/${contestId}/leaderboard`); }

  getTabulators() { return this.http.get<Tabulator[]>('/api/tabulators'); }
  createTabulator(data: { username: string; name: string; password: string }) { return this.http.post('/api/tabulators', data); }
  deleteTabulator(id: string) { return this.http.delete(`/api/tabulators/${id}`); }

  getAuditLogs(params?: { search?: string; role?: string }) {
    const qs = new URLSearchParams(params as any).toString();
    return this.http.get<AuditLog[]>(`/api/audit-logs${qs ? '?' + qs : ''}`);
  }
  clearAuditLogs() { return this.http.delete('/api/audit-logs'); }
}
