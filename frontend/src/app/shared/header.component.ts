import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { StateService } from '../core/state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <header class="bg-indigo-950 text-white shadow-xl sticky top-0 z-30 border-b border-indigo-900/60 no-print">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center space-x-3">
        <div class="p-2 bg-indigo-900/70 border border-indigo-700/50 rounded-xl text-amber-400 shadow-inner">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-black tracking-tight text-white">Tabulator Pro</span>
            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border"
              [ngClass]="isHead ? 'bg-amber-400 text-indigo-950 font-black' : isJudge ? 'bg-emerald-800 text-emerald-200 border-emerald-700' : 'bg-indigo-800 text-indigo-200 border-indigo-700'">
              {{ roleBadge }}
            </span>
          </div>
          <p class="text-xs text-indigo-200 font-medium truncate max-w-xs sm:max-w-md">{{ activeTitle }}</p>
        </div>
      </div>
      <nav class="flex items-center space-x-1 sm:space-x-2 text-sm font-medium" *ngIf="!isJudge">
        <a routerLink="/app/setup" routerLinkActive="bg-indigo-800 text-white" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">1. Setup</a>
        <a routerLink="/app/audit" routerLinkActive="bg-indigo-800 text-white" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">2. Scoresheet Audit</a>
        <a routerLink="/app/leaderboard" routerLinkActive="bg-indigo-800 text-white" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">3. Tabulation</a>
        <a *ngIf="isHead" routerLink="/app/audit-logs" routerLinkActive="bg-indigo-800 text-white" class="px-3 py-1.5 rounded-lg text-amber-300 hover:bg-indigo-900 font-bold text-xs transition flex items-center gap-1">4. Audit Log</a>
      </nav>
      <nav *ngIf="isJudge" class="flex items-center">
        <span class="px-3.5 py-1.5 rounded-lg bg-indigo-900 text-white font-bold text-xs border border-indigo-700/80 shadow-inner flex items-center gap-1.5">
          <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          <span>Judge Scorecard</span>
        </span>
      </nav>
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="text-right hidden sm:block">
          <p class="text-xs font-bold text-amber-300">{{ userName }}</p>
          <p class="text-[10px] text-indigo-300">{{ roleSub }}</p>
        </div>
        <button *ngIf="isTabulator" (click)="changePw.emit()" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 hover:bg-indigo-800 text-indigo-200 hover:text-white border border-indigo-700/80 transition flex items-center gap-1.5 shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          <span class="hidden md:inline">Change Password</span>
        </button>
        <button (click)="onLogout()" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 hover:bg-rose-700 text-white border border-indigo-700/80 transition flex items-center gap-1.5 shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  </header>
  `
})
export class HeaderComponent {
  auth = inject(AuthService);
  state = inject(StateService);
  changePw: any = { emit: () => {} }; // will be replaced via Output in shell

  get isHead() { return this.auth.isHead(); }
  get isJudge() { return this.auth.isJudge(); }
  get isTabulator() { return this.auth.isTabulator(); }
  get userName() { return this.auth.user()?.name || ''; }
  get roleBadge() {
    if (this.isJudge) return 'Judge Panelist';
    if (this.isHead) return 'Admin / Head Tabulator';
    return 'Assistant Tabulator';
  }
  get roleSub() {
    if (this.isJudge) return 'Isolated Evaluation Terminal';
    if (this.isHead) return 'Full Superadmin Access';
    return 'Restricted Tabulation Access';
  }
  get activeTitle() { return this.state.activeContest?.title || ''; }

  onLogout() {
    this.auth.logout();
    location.href = '/login';
  }
}
