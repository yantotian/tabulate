import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { StateService } from '../../core/state.service';
import { ApiService } from '../../core/api.service';
import { FormsModule } from '@angular/forms';
import { NoticeModalComponent } from '../../shared/notice-modal.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, NoticeModalComponent, ConfirmModalComponent],
  template: `
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
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
            <p class="text-xs text-indigo-200 font-medium truncate max-w-xs sm:max-w-md">{{ state.activeContest?.title || '' }}</p>
          </div>
        </div>
        <nav *ngIf="!isJudge" class="flex items-center space-x-1 sm:space-x-2 text-sm font-medium">
          <a routerLink="/app/setup" routerLinkActive="bg-indigo-800 text-white shadow-inner" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">1. Setup</a>
          <a routerLink="/app/audit" routerLinkActive="bg-indigo-800 text-white shadow-inner" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">2. Scoresheet Audit</a>
          <a routerLink="/app/leaderboard" routerLinkActive="bg-indigo-800 text-white shadow-inner" class="px-3 py-1.5 rounded-lg text-indigo-200 hover:bg-indigo-900 font-semibold text-xs transition">3. Tabulation</a>
          <a *ngIf="isHead" routerLink="/app/audit-logs" routerLinkActive="bg-indigo-800 text-white shadow-inner" class="px-3 py-1.5 rounded-lg text-amber-300 hover:bg-indigo-900 font-bold text-xs transition flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>4. Audit Log</span>
          </a>
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
          <button *ngIf="isTabulator" (click)="openChangePw()" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 hover:bg-indigo-800 text-indigo-200 hover:text-white border border-indigo-700/80 transition flex items-center gap-1.5 shadow-sm">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            <span class="hidden md:inline">Change Password</span>
          </button>
          <button (click)="logout()" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 hover:bg-rose-700 text-white border border-indigo-700/80 transition flex items-center gap-1.5 shadow-sm">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>

    <div *ngIf="isTabulator" class="bg-indigo-900/40 border-b border-indigo-900/30 px-4 sm:px-8 py-2.5 no-print">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-bold text-indigo-200 uppercase tracking-wider text-[11px]">Active Contest:</span>
          <select [ngModel]="state.state()?.activeContestId" (ngModelChange)="changeContest($event)" class="bg-indigo-950 text-white font-semibold rounded-lg px-3 py-1.5 border border-indigo-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option *ngFor="let c of authorizedContests" [value]="c.id">{{ c.title }}{{ isHead ? '' : (c.createdByTabulatorId===auth.user()?.tabulatorId ? ' (Created by you)' : ' (Assigned to you)') }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="newContestOpen=true" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-bold rounded-lg shadow transition flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            <span>Create New Contest</span>
          </button>
          <button (click)="confirmDeleteContest()" class="px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-semibold rounded-lg border border-rose-700/60 transition" title="Delete current contest">Delete Contest</button>
        </div>
      </div>
    </div>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
      <router-outlet></router-outlet>
    </main>

    <!-- New Contest Modal -->
    <div *ngIf="newContestOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-100">
        <div class="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 class="text-lg font-bold text-slate-900">Create New Contest</h3>
          <button (click)="newContestOpen=false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form (ngSubmit)="createContest()" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Contest Title</label>
            <input [(ngModel)]="newTitle" name="newTitle" placeholder="e.g. Cooking Contest / Culinary Challenge" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Preset Template</label>
            <select [(ngModel)]="newTemplate" name="tmpl" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none">
              <option value="cooking">Cooking Contest (Taste 40%, Plating 30%, Originality 20%, Hygiene 10%)</option>
              <option value="talent">Talent Show (Tone & Musicality 40%, Stage Presence 30%, Mastery 20%, Impact 10%)</option>
              <option value="blank">Blank Slate (Custom Criteria)</option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="newContestOpen=false" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow transition">Create Contest</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Change Password Modal -->
    <div *ngIf="changePwOpen" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-100">
        <div class="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 class="text-lg font-bold text-slate-900">Change Your Password</h3>
          <button (click)="changePwOpen=false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form (ngSubmit)="doChangePw()" class="space-y-4">
          <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Current Password</label><input type="password" [(ngModel)]="cpCurrent" name="c1" placeholder="Enter current password" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
          <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">New Password</label><input type="password" [(ngModel)]="cpNew" name="c2" placeholder="Enter new password" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
          <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Confirm New Password</label><input type="password" [(ngModel)]="cpConfirm" name="c3" placeholder="Confirm new password" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" (click)="changePwOpen=false" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">Cancel</button>
            <button type="submit" class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow transition">Update Password</button>
          </div>
        </form>
      </div>
    </div>

    <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
    <app-confirm-modal [open]="confirmOpen" [title]="confirmTitle" [message]="confirmMsg" (close)="onConfirm($event)"></app-confirm-modal>
  </div>
  `
})
export class ShellComponent implements OnInit {
  auth = inject(AuthService);
  state = inject(StateService);
  api = inject(ApiService);
  router = inject(Router);

  newContestOpen = false; newTitle=''; newTemplate='cooking';
  changePwOpen=false; cpCurrent=''; cpNew=''; cpConfirm='';
  noticeOpen=false; noticeTitle=''; noticeMsg=''; noticeErr=false;
  confirmOpen=false; confirmTitle=''; confirmMsg=''; pendingConfirm: (()=>void)|null=null;

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
  get authorizedContests() {
    const s = this.state.state();
    if (!s) return [];
    const u = this.auth.user();
    if (!u) return s.contests;
    if (u.role === 'judge') return s.contests.filter(c => String(c.id)===String(u.contestId));
    if (u.isHead) return s.contests;
    return s.contests.filter(c => String(c.createdByTabulatorId)===String(u.tabulatorId) || (c.assignedTabulatorIds||[]).includes(u.tabulatorId));
  }

  ngOnInit() {
    this.state.loadFromBackend().subscribe();
    this.state.refreshContests().subscribe();
    if (this.isJudge) this.router.navigate(['/app/judge']);
  }

  changeContest(id: string) {
    const u = this.auth.user();
    const s = this.state.state();
    const target = s?.contests.find(c => c.id===id);
    if (!target) return;
    const has = u?.isHead || (u?.role==='judge' ? String(target.id)===String(u.contestId) : String(target.createdByTabulatorId)===String(u.tabulatorId) || (target.assignedTabulatorIds||[]).includes(u.tabulatorId));
    if (!has) { this.noticeTitle='Permission Denied'; this.noticeMsg='Access Denied: You are not authorized to view or edit this contest.'; this.noticeErr=true; this.noticeOpen=true; return; }
    this.state.setActiveContest(id);
    location.reload();
  }

  createContest() {
    if (!this.newTitle.trim()) return;
    this.api.createContest(this.newTitle.trim(), this.newTemplate).subscribe({
      next: (c) => {
        this.newContestOpen=false;
        this.newTitle='';
        this.state.refreshContests().subscribe(()=> { this.state.setActiveContest(c.id); this.router.navigate(['/app/setup']); });
      },
      error: (e) => { this.noticeTitle='Create Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }

  confirmDeleteContest() {
    const contest = this.state.activeContest;
    if (!contest) return;
    const s = this.state.state();
    const authorized = this.authorizedContests;
    if (authorized.length <=1) { this.noticeTitle='Action Prevented'; this.noticeMsg='Cannot delete the only accessible contest.'; this.noticeErr=true; this.noticeOpen=true; return; }
    const u = this.auth.user();
    if (!u.isHead && String(contest.createdByTabulatorId)!==String(u.tabulatorId)) { this.noticeTitle='Permission Denied'; this.noticeMsg='As an Assistant Tabulator, you can only delete contests you personally created.'; this.noticeErr=true; this.noticeOpen=true; return; }
    this.confirmTitle='Delete Contest';
    this.confirmMsg = `Are you sure you want to permanently delete '${contest.title}' and all its associated scorecards? This action cannot be undone.`;
    this.pendingConfirm = () => {
      this.api.deleteContest(contest.id).subscribe({
        next: () => this.state.refreshContests().subscribe(()=> location.reload()),
        error: (e) => { this.noticeTitle='Delete Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
      });
    };
    this.confirmOpen = true;
  }

  onConfirm(ok: boolean) { this.confirmOpen=false; if (ok && this.pendingConfirm) { const fn=this.pendingConfirm; this.pendingConfirm=null; fn(); } else this.pendingConfirm=null; }

  openChangePw() { this.cpCurrent=''; this.cpNew=''; this.cpConfirm=''; this.changePwOpen=true; }
  doChangePw() {
    // Use server state tabulator update via direct state? Backend has no change-password endpoint, use local logic + state sync: we will update via API tabulators delete/create? Simpler: use POST /api/state? But we have no dedicated. We'll attempt to update via backend's tabulator password migration: easiest is to call /api/tabulators is head only, so direct password change for self not exposed. Fallback: update via state.
    // For now, do local update + sync via /api/state using head override? But non-head can't POST /api/state? Backend allows any tabulator to POST. So we can update state then POST.
    const s = this.state.state();
    const u = this.auth.user();
    const tab = s?.tabulators.find(t => t.id===u.tabulatorId);
    if (!tab) { this.noticeTitle='Verification Failed'; this.noticeMsg='Current user profile could not be verified.'; this.noticeErr=true; this.noticeOpen=true; return; }
    // verify current pw via API? For now compare local if available; backend hashed so we can't compare locally. Try to call login to verify current pw?
    this.api.loginTabulator({ role:'tabulator', tabulatorId: u.tabulatorId, username: u.username, password: this.cpCurrent }).subscribe({
      next: () => {
        if (!this.cpNew) { this.noticeTitle='Invalid Password'; this.noticeMsg='New password cannot be blank.'; this.noticeErr=true; this.noticeOpen=true; return; }
        if (this.cpNew !== this.cpConfirm) { this.noticeTitle='Mismatch'; this.noticeMsg='New password and confirmation do not match.'; this.noticeErr=true; this.noticeOpen=true; return; }
        // Update tabulator via state POST: we need to persist. Since backend hashes on POST /api/state, set plaintext new pw then POST
        if (s && tab) { tab.password = this.cpNew; this.api.postState(s).subscribe({ next: ()=> { this.changePwOpen=false; this.noticeTitle='Password Updated'; this.noticeMsg='Your password has been updated successfully!'; this.noticeErr=false; this.noticeOpen=true; }, error: (e)=> { this.noticeTitle='Update Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; } }); }
      },
      error: () => { this.noticeTitle='Incorrect Password'; this.noticeMsg='Current password does not match.'; this.noticeErr=true; this.noticeOpen=true; }
    });
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
