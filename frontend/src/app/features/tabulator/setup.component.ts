import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/state.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { NoticeModalComponent } from '../../shared/notice-modal.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, NoticeModalComponent, ConfirmModalComponent],
  template: `
  <!-- Contest-dependent Setup (changes with Active Contest selector) -->
  <div *ngIf="contest" class="space-y-6">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
      <div class="flex-1 min-w-[280px]">
        <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Current Contest Title</label>
        <div class="flex items-center gap-2">
          <input [(ngModel)]="contest.title" (change)="rename()" class="text-xl sm:text-2xl font-black text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-1.5 w-full focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
          <button (click)="promptRename()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs whitespace-nowrap transition">Rename</button>
        </div>
      </div>
      <div class="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm" [ngClass]="sum===100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'">
        <span *ngIf="sum===100">✓ Criteria total: 100% — Valid</span>
        <span *ngIf="sum!==100">⚠ Total {{ sum }}% — Must be 100%</span>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Contest Ownership &amp; Access Delegation</span>
            <span class="text-xs font-normal text-slate-500">{{ contest.createdByName ? '• Created by ' + contest.createdByName : '' }}</span>
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Head can delegate assistant tabulators checked below. Assistants see assigned contests only.</p>
        </div>
      </div>
      <div *ngIf="isHead" class="space-y-2">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Delegate Access to Assistant Tabulators</label>
        <div class="flex flex-wrap gap-2">
          <label *ngFor="let t of assistantTabs" class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer" [ngClass]="isAssigned(t.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-600'">
            <input type="checkbox" [checked]="isAssigned(t.id)" (change)="toggleAssign(t.id, $any($event.target).checked)" class="w-3.5 h-3.5" />
            <span>{{ t.name }} (@{{ t.username }})</span>
          </label>
          <span *ngIf="assistantTabs.length===0" class="text-xs text-slate-400">No assistant tabulators created yet.</span>
        </div>
      </div>
      <div *ngIf="!isHead" class="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
        Assigned assistants: {{ assignedNames || 'None' }}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 space-y-6">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
            <div><h3 class="text-base font-bold text-slate-900">Judging Criteria &amp; Percentage Weights</h3><p class="text-xs text-slate-500">Criteria percentages must total exactly 100%.</p></div>
            <span class="px-2.5 py-1 rounded-full text-xs font-black" [ngClass]="sum===100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">{{ sum }}%</span>
          </div>
          <div class="space-y-3 mb-4">
            <div *ngFor="let crit of contest.criteria" class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <input [(ngModel)]="crit.name" (change)="updateCriterion(crit)" class="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none" placeholder="Criterion name" />
              <input type="number" [(ngModel)]="crit.weight" (change)="updateCriterion(crit)" class="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:ring-2 focus:ring-indigo-600 focus:outline-none" min="0" max="100" />
              <span class="text-xs font-bold text-slate-500">%</span>
              <button (click)="removeCriterion(crit.id)" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200">Remove</button>
            </div>
          </div>
          <button (click)="addCriterion()" class="w-full py-2.5 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-700 hover:bg-indigo-50/50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5">+ Add New Criterion</button>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
            <div><h3 class="text-base font-bold text-slate-900 flex items-center gap-1.5"><span class="text-rose-500">⚠️</span> Preset Penalty &amp; Infraction Rules</h3><p class="text-xs text-slate-500">Rules guiding judges when penalizing contestants (points deducted directly).</p></div>
          </div>
          <div class="space-y-3 mb-4">
            <div *ngFor="let p of contest.penalties" class="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <input [(ngModel)]="p.name" (change)="updatePenalty(p)" class="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
              <input type="number" [(ngModel)]="p.defaultDeduction" (change)="updatePenalty(p)" class="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:ring-2 focus:ring-rose-600 focus:outline-none" step="0.5" />
              <span class="text-xs text-slate-500">pts</span>
              <button (click)="removePenalty(p.id)" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200">Remove</button>
            </div>
          </div>
          <button (click)="addPenalty()" class="w-full py-2.5 border-2 border-dashed border-rose-200 hover:border-rose-400 text-rose-700 hover:bg-rose-50/50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5">+ Add Penalty Rule</button>
        </div>
      </div>

      <div class="lg:col-span-5 space-y-6">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
            <div><h3 class="text-base font-bold text-slate-900">Contestants / Teams</h3><p class="text-xs text-slate-500">Participants competing in this specific contest.</p></div>
            <span class="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{{ contest.contestants.length }}</span>
          </div>
          <div class="space-y-2.5 mb-4">
            <div *ngFor="let c of contest.contestants" class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
              <input [(ngModel)]="c.name" (change)="updateContestant(c)" class="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium" />
              <button (click)="removeContestant(c.id)" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200">✕</button>
            </div>
          </div>
          <button (click)="addContestant()" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition">+ Add Contestant</button>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
            <div><h3 class="text-base font-bold text-slate-900">Assigned Judges Panel</h3><p class="text-xs text-slate-500">Configure judge names and custom login passwords.</p></div>
            <span class="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">{{ contest.judges.length }}</span>
          </div>
          <div class="space-y-3 mb-4">
            <div *ngFor="let j of contest.judges" class="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <input [(ngModel)]="j.name" (change)="updateJudge(j)" class="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium" placeholder="Judge name" />
              <div class="flex items-center gap-2">
                <input type="password" [value]="j.password ? '••••••••' : ''" (change)="updateJudgePw(j, $any($event.target).value)" placeholder="New password (leave blank to keep)" class="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                <button (click)="removeJudge(j.id)" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200">Remove</button>
              </div>
            </div>
          </div>
          <button (click)="addJudge()" class="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition">+ Add Judge to Contest</button>
        </div>
      </div>
    </div>
  </div>

  <div *ngIf="!contest" class="bg-white rounded-2xl p-8 text-center text-slate-500">No accessible contest. Create one via toolbar.</div>

  <!-- Constant: Tabulator Accounts Management — global, not tied to selected contest -->
  <div *ngIf="isHead" class="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 relative overflow-hidden mt-6">
    <div class="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
      <div><h3 class="text-base font-bold text-slate-900 flex items-center gap-2"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-indigo-950">Head Admin Only</span><span>Tabulator Accounts Management</span></h3><p class="text-xs text-slate-500">Head exclusive portal to register assistant tabulators and manage credentials. Constant across all contests.</p></div>
      <span class="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">{{ tabulators.length }}</span>
    </div>
    <div class="space-y-3 mb-4">
      <div *ngFor="let t of tabulators" class="flex items-center gap-2 p-3 rounded-xl border" [ngClass]="t.isHead ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'">
        <div class="flex-1 grid grid-cols-3 gap-2">
          <input [(ngModel)]="t.name" (change)="updateTab(t,'name',t.name)" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium" [readonly]="t.isHead" />
          <input [(ngModel)]="t.username" (change)="updateTab(t,'username',t.username)" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono" [readonly]="t.isHead" />
          <span class="text-xs px-2 py-1.5 bg-white border rounded-lg font-mono text-slate-500 truncate">{{ t.isHead ? '••••••••' : '••••••••' }}</span>
        </div>
        <span *ngIf="t.isHead" class="text-[10px] font-black px-2 py-1 bg-amber-400 text-indigo-950 rounded">HEAD</span>
        <button *ngIf="!t.isHead" (click)="removeTab(t.id)" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200">Remove</button>
      </div>
    </div>
    <button (click)="openTabModal=true" class="w-full py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">+ Create Another Tabulator Account</button>
  </div>

  <!-- Add Tabulator Modal -->
  <div *ngIf="openTabModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 border border-slate-100">
      <div class="flex justify-between items-center pb-2 border-b border-slate-100"><h3 class="text-lg font-bold text-slate-900">Add Assistant Tabulator</h3><button (click)="openTabModal=false" class="text-slate-400 hover:text-slate-600">✕</button></div>
      <form (ngSubmit)="createTab()" class="space-y-4">
        <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Display / Official Name</label><input [(ngModel)]="newTabName" name="tn" placeholder="e.g. Assistant Tabulator Jane" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
        <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Username (Login ID)</label><input [(ngModel)]="newTabUser" name="tu" placeholder="e.g. tabulator_jane" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
        <div><label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Initial Password</label><input type="password" [(ngModel)]="newTabPw" name="tp" value="Bayugan123" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none" required /></div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" (click)="openTabModal=false" class="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white shadow transition">Create Account</button>
        </div>
      </form>
    </div>
  </div>

  <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
  <app-confirm-modal [open]="confirmOpen" [title]="confirmTitle" [message]="confirmMsg" (close)="onConfirm($event)"></app-confirm-modal>
  `
})
export class SetupComponent implements OnInit {
  state = inject(StateService);
  api = inject(ApiService);
  auth = inject(AuthService);
  contest: any = null;
  tabulators: any[] = [];
  openTabModal=false;
  newTabName=''; newTabUser=''; newTabPw='Bayugan123';
  noticeOpen=false; noticeTitle=''; noticeMsg=''; noticeErr=false;
  confirmOpen=false; confirmTitle=''; confirmMsg=''; pending: (()=>void)|null=null;

  get isHead() { return this.auth.isHead(); }
  get sum() { return (this.contest?.criteria || []).reduce((a:number,b:any)=> a + (parseFloat(b.weight)||0), 0); }
  get assistantTabs() { return this.tabulators.filter(t=>!t.isHead); }
  get assignedNames() {
    const ids = this.contest?.assignedTabulatorIds||[];
    return this.assistantTabs.filter(t=> ids.includes(t.id)).map(t=> t.name).join(', ') || '';
  }

  constructor() {
    // Keep contest in sync with Active Contest selector without full page reload;
    // tabulators array is global and stays constant — not re-created on contest switch.
    effect(() => {
      // track state signal
      this.state.state();
      const active = this.state.activeContest;
      if (active) {
        if (!this.contest || String(this.contest.id) !== String(active.id)) this.contest = active;
      } else if (!this.contest) {
        this.contest = active;
      }
      const s = this.state.state();
      if (s?.tabulators?.length && this.tabulators.length === 0) this.tabulators = s.tabulators;
    });
  }

  ngOnInit() { this.load(); }
  load() {
    const init = () => {
      this.contest = this.state.activeContest;
      const s = this.state.state();
      if (s) this.tabulators = s.tabulators || [];
      // refresh from backend tabulators if head — constant, independent of contest
      if (this.isHead) this.api.getTabulators().subscribe({ next: d=> this.tabulators = d as any, error: ()=>{} });
    };
    if (this.state.state()) init(); else this.state.loadFromBackend().subscribe(()=> init());
    this.state.refreshContests().subscribe(()=> init());
  }

  isAssigned(id:string) { return (this.contest?.assignedTabulatorIds||[]).includes(id); }
  toggleAssign(id:string, grant:boolean) {
    let arr = [...(this.contest.assignedTabulatorIds||[])];
    if (grant) { if (!arr.includes(id)) arr.push(id); } else arr = arr.filter(x=> x!==id);
    // Persist via state POST (no dedicated endpoint)
    const s = this.state.state();
    if (s) {
      const c = s.contests.find(x=> x.id===this.contest.id);
      if (c) { c.assignedTabulatorIds = arr; this.contest.assignedTabulatorIds = arr; this.api.postState(s).subscribe({}); }
    }
  }

  rename() { this.api.updateContest(this.contest.id, this.contest.title).subscribe({}); }
  promptRename() {
    const val = prompt('Enter new title for this contest:', this.contest.title);
    if (val && val.trim()) { this.contest.title = val.trim(); this.rename(); }
  }

  addCriterion() { this.api.addCriterion(this.contest.id, 'New Criterion', 10).subscribe({ next: () => this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }
  updateCriterion(c:any) { this.api.updateCriterion(this.contest.id, c.id, { name: c.name, weight: parseFloat(c.weight)||0 }).subscribe({}); }
  removeCriterion(id:any) { this.api.deleteCriterion(this.contest.id, id).subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }

  addPenalty() { this.api.addPenalty(this.contest.id, 'New Penalty', 2).subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }
  updatePenalty(p:any) { this.api.updatePenalty(this.contest.id, p.id, { name: p.name, defaultDeduction: parseFloat(p.defaultDeduction)||0 }).subscribe({}); }
  removePenalty(id:any) { this.api.deletePenalty(this.contest.id, id).subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }

  addContestant() { this.api.addContestant(this.contest.id, 'New Contestant').subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }
  updateContestant(c:any) { this.api.updateContestant(this.contest.id, c.id, c.name).subscribe({}); }
  removeContestant(id:any) { this.api.deleteContestant(this.contest.id, id).subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }

  addJudge() { this.api.addJudge(this.contest.id, 'New Judge', 'Bayugan123').subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }
  updateJudge(j:any) { this.api.updateJudge(this.contest.id, j.id, { name: j.name }).subscribe({}); }
  updateJudgePw(j:any, pw:string) { if (!pw) return; this.api.updateJudge(this.contest.id, j.id, { password: pw }).subscribe({}); }
  removeJudge(id:any) { this.api.deleteJudge(this.contest.id, id).subscribe({ next: ()=> this.state.refreshContests().subscribe(()=> this.contest=this.state.activeContest) }); }

  createTab() {
    if (!this.newTabName || !this.newTabUser || !this.newTabPw) { this.noticeTitle='Missing Details'; this.noticeMsg='Please complete all fields.'; this.noticeErr=true; this.noticeOpen=true; return; }
    this.api.createTabulator({ username: this.newTabUser, name: this.newTabName, password: this.newTabPw }).subscribe({
      next: ()=> { this.openTabModal=false; this.newTabName=''; this.newTabUser=''; this.newTabPw='Bayugan123'; this.load(); this.noticeTitle='Account Created'; this.noticeMsg='Assistant tabulator created.'; this.noticeOpen=true; },
      error: (e)=> { this.noticeTitle='Create Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
  updateTab(t:any, key:string, val:string) {
    // No update endpoint for tabulators; backend only create/delete; so fallback to state POST for rename
    const s = this.state.state();
    if (s) {
      const found = s.tabulators.find(x=> x.id===t.id);
      if (found) {
        if (key==='username') {
          const clean = val.trim().toLowerCase();
          if (s.tabulators.some(x=> x.id!==t.id && x.username.toLowerCase()===clean)) { this.noticeTitle='Username Taken'; this.noticeMsg='Taken'; this.noticeErr=true; this.noticeOpen=true; this.load(); return; }
          (found as any)[key]=clean;
        } else (found as any)[key]=val;
        this.api.postState(s).subscribe({});
      }
    }
  }
  removeTab(id:string) {
    this.confirmTitle='Remove Tabulator'; this.confirmMsg='Are you sure you want to remove this assistant?';
    this.pending = ()=> this.api.deleteTabulator(id).subscribe({ next: ()=> this.load(), error: (e)=> { this.noticeTitle='Delete Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; } });
    this.confirmOpen=true;
  }
  onConfirm(ok:boolean){ this.confirmOpen=false; if(ok && this.pending){ const fn=this.pending; this.pending=null; fn(); } else this.pending=null; }
}
