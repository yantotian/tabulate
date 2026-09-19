import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { StateService } from '../../core/state.service';
import { NoticeModalComponent } from '../../shared/notice-modal.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, NoticeModalComponent],
  template: `
  <div class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 space-y-6 border border-slate-100">
      <div class="text-center space-y-2">
        <div class="inline-flex p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-900 shadow-sm mb-1">
          <svg class="w-8 h-8 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">Tabulator Pro</h1>
        <p class="text-xs text-slate-500 font-medium">Contest Tabulation &amp; Audit Trail Platform</p>
      </div>

      <form (ngSubmit)="handleLogin()" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Portal Role</label>
          <select [(ngModel)]="role" name="role" (ngModelChange)="syncRole()" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none transition">
            <option value="judge">Judge Panelist</option>
            <option value="tabulator">Tabulator / Administrator</option>
          </select>
        </div>

        <div *ngIf="role === 'tabulator'" class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Select Tabulator Account</label>
          <select [(ngModel)]="selectedTabulatorId" name="tabId" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none transition">
            <option *ngFor="let t of tabulators" [value]="t.id">{{ t.name }} {{ t.isHead ? '★ (Head Tabulator)' : '• (Assistant)' }}</option>
          </select>
        </div>

        <div *ngIf="role === 'judge'" class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Select Contest</label>
          <select [(ngModel)]="selectedContestId" name="contestId" (ngModelChange)="syncJudges()" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none transition">
            <option *ngFor="let c of contests" [value]="c.id">{{ c.title }}</option>
          </select>
        </div>

        <div *ngIf="role === 'judge'" class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Select Judge Profile</label>
          <select [(ngModel)]="selectedJudgeId" name="judgeId" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none transition">
            <option *ngFor="let j of filteredJudges" [value]="j.id">{{ j.name }}</option>
            <option *ngIf="filteredJudges.length===0" value="">No judges registered for this contest</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between items-center">
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
            <span class="text-[11px] text-indigo-600 font-semibold cursor-pointer hover:underline" (click)="showHint()">Need Help?</span>
          </div>
          <div class="relative flex items-center">
            <input [type]="showPw ? 'text' : 'password'" [(ngModel)]="password" name="pw" placeholder="Enter password" class="w-full bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none transition" required />
            <button type="button" (click)="showPw = !showPw" class="absolute right-0 pr-3 flex items-center justify-center text-slate-400 hover:text-indigo-600 focus:outline-none transition cursor-pointer">
              <svg *ngIf="!showPw" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <svg *ngIf="showPw" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
            </button>
          </div>
        </div>

        <button type="submit" [disabled]="loading" class="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-60">
          <span>{{ loading ? 'Authenticating...' : 'Enter Portal' }}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </form>
    </div>
  </div>

  <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
  `
})
export class LoginComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private state = inject(StateService);
  private router = inject(Router);

  role: 'judge' | 'tabulator' = 'judge';
  tabulators: any[] = [];
  contests: any[] = [];
  filteredJudges: any[] = [];
  selectedTabulatorId = '';
  selectedContestId = '';
  selectedJudgeId: any = '';
  password = '';
  showPw = false;
  loading = false;

  noticeOpen = false; noticeTitle=''; noticeMsg=''; noticeErr=false;

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.auth.isJudge() ? '/app/judge' : '/app/setup']);
      return;
    }
    this.loadData();
  }
  loadData() {
    // Load public contests for login dropdowns
    this.api.publicContests().subscribe({
      next: d => {
        this.contests = d || [];
        if (this.contests.length && !this.selectedContestId) this.selectedContestId = this.contests[0].id;
        this.syncJudges();
        // Also try to get tabulators via state (public fallback requires auth, so use state if available)
        this.state.loadFromBackend().subscribe(() => {
          const s = this.state.state();
          if (s?.tabulators?.length) {
            this.tabulators = s.tabulators;
            if (!this.selectedTabulatorId && this.tabulators.length) this.selectedTabulatorId = this.tabulators[0].id;
          }
        });
        // If state didn't load, fallback to public + default admin
        if (!this.tabulators.length) {
          this.tabulators = [{ id: 'tab_head', username: 'admin', name: 'Admin / Head Tabulator', isHead: true }];
          this.selectedTabulatorId = 'tab_head';
        }
      },
      error: () => {
        // Fallback: load from state service
        const s = this.state.state();
        if (s) {
          this.contests = s.contests as any;
          this.tabulators = s.tabulators;
          if (this.contests.length) this.selectedContestId = this.contests[0].id;
          if (this.tabulators.length) this.selectedTabulatorId = this.tabulators[0].id;
          this.syncJudges();
        }
      }
    });
    // Ensure tabulators also loaded if publicContests slow
    this.state.loadFromBackend().subscribe(() => {
      const s = this.state.state();
      if (s?.tabulators?.length && !this.tabulators.length) {
        this.tabulators = s.tabulators;
        this.selectedTabulatorId = this.tabulators[0].id;
      }
      if (s?.contests?.length && !this.contests.length) {
        this.contests = s.contests as any;
        this.selectedContestId = (s.contests as any)[0].id;
        this.syncJudges();
      }
    });
  }
  syncRole() { this.showPw = false; }
  syncJudges() {
    const c = this.contests.find((x: any) => x.id === this.selectedContestId);
    this.filteredJudges = c?.judges || [];
    if (this.filteredJudges.length) this.selectedJudgeId = this.filteredJudges[0].id;
    else this.selectedJudgeId = '';
  }
  showHint() { this.noticeTitle='Login Assistance'; this.noticeMsg='Please enter your assigned account password. If you do not know or forgot your password, please contact the Head Tabulator or Administrator.'; this.noticeErr=false; this.noticeOpen=true; }
  handleLogin() {
    if (!this.password) { this.noticeTitle='Missing Password'; this.noticeMsg='Please enter password.'; this.noticeErr=true; this.noticeOpen=true; return; }
    this.loading = true;
    if (this.role === 'tabulator') {
      const tab = this.tabulators.find(t => t.id === this.selectedTabulatorId);
      const username = tab?.username || this.selectedTabulatorId;
      this.auth.loginTabulator(this.selectedTabulatorId, username, this.password).subscribe({
        next: () => {
          this.state.loadFromBackend().subscribe(() => {
            this.loading = false;
            this.router.navigate(['/app/setup']);
          });
        },
        error: (e) => { this.loading=false; this.noticeTitle='Access Denied'; this.noticeMsg = e?.error?.error || e?.message || 'Invalid credentials'; this.noticeErr=true; this.noticeOpen=true; }
      });
    } else {
      if (!this.selectedContestId || !this.selectedJudgeId) { this.loading=false; this.noticeTitle='Selection Required'; this.noticeMsg='Please select contest and judge.'; this.noticeErr=true; this.noticeOpen=true; return; }
      this.auth.loginJudge(this.selectedContestId, this.selectedJudgeId, this.password).subscribe({
        next: () => {
          this.state.loadFromBackend().subscribe(() => { this.loading=false; this.router.navigate(['/app/judge']); });
        },
        error: (e) => { this.loading=false; this.noticeTitle='Access Denied'; this.noticeMsg = e?.error?.error || e?.message || 'Invalid credentials'; this.noticeErr=true; this.noticeOpen=true; }
      });
    }
  }
}
