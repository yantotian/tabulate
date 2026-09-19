import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/state.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { getPenaltyTotal, getSelectedPenaltyIds, getAllowedPenalties, getCriterionWeight } from '../../core/contest-utils';
import { NoticeModalComponent } from '../../shared/notice-modal.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, NoticeModalComponent],
  template: `
  <div *ngIf="contest" class="space-y-6">
    <div class="p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm border" [ngClass]="isHead ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-amber-50 border-amber-200 text-amber-800'">
      <div class="flex items-center gap-2">
        <span *ngIf="isHead" class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
        <span *ngIf="!isHead" class="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
        <span class="text-xs font-bold">{{ isHead ? 'Head Tabulator — Full Override Access: You may directly correct any judge score or penalty.' : '🔒 Assistant Tabulator — Read-Only: You can view but cannot override scores (Head only).' }}</span>
      </div>
    </div>

    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
      <div class="flex items-center space-x-3">
        <label class="text-xs font-bold text-slate-700 uppercase tracking-wider">Audit Judge Card:</label>
        <select [(ngModel)]="selectedJudgeId" (ngModelChange)="render()" class="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          <option *ngFor="let j of contest.judges" [value]="j.id">{{ j.name }}</option>
        </select>
      </div>
      <div class="text-xs text-slate-500 flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
        <span>Real-time cross-evaluation review and inspection.</span>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto p-6">
      <table class="w-full text-left border-collapse text-sm">
        <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
          <tr>
            <th class="py-3 px-4">Contestant / Team</th>
            <th *ngFor="let crit of contest.criteria" class="py-3 px-3 text-center">{{ crit.name }} <span class="text-indigo-600">({{ crit.weight }}%)</span></th>
            <th class="py-3 px-3 text-center text-rose-600">Penalties</th>
            <th class="py-3 px-4 text-right">Net Weighted</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr *ngFor="let c of contest.contestants" class="hover:bg-slate-50">
            <td class="py-3 px-4 font-bold text-slate-900">{{ c.name }}</td>
            <td *ngFor="let crit of contest.criteria" class="py-2.5 px-3 text-center">
              <input type="number" min="0" [attr.max]="crit.weight" step="0.01" [ngModel]="getScore(c.id, crit.id)" (ngModelChange)="onOverrideScore(c.id, crit.id, $event)" [readonly]="!isHead" [ngClass]="!isHead ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'" class="w-20 text-center border border-slate-300 rounded-lg py-1 px-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
            </td>
            <td class="py-2.5 px-3">
              <div class="space-y-1.5 min-w-[180px]">
                <label *ngFor="let rule of allowed" class="flex items-center gap-2 px-2 py-1 rounded-lg border text-xs" [ngClass]="isChecked(c.id, rule.id) ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold' : 'bg-white border-slate-200 text-slate-700'">
                  <input type="checkbox" [checked]="isChecked(c.id, rule.id)" (change)="onPenalty(c.id, rule.id, $any($event.target).checked)" [disabled]="!isHead" class="w-3.5 h-3.5" />
                  <span>{{ rule.name }} (-{{ rule.defaultDeduction }})</span>
                </label>
                <div class="text-[11px] text-rose-600 font-semibold">Total: -{{ getPenalty(c.id) }}</div>
              </div>
            </td>
            <td class="py-3 px-4 text-right font-black text-indigo-700">{{ getNet(c.id) | number:'1.2-2' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div *ngIf="!contest" class="bg-white p-8 text-center text-slate-500">No contest.</div>
  <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
  `
})
export class AuditComponent implements OnInit {
  state = inject(StateService);
  api = inject(ApiService);
  auth = inject(AuthService);
  contest: any = null;
  selectedJudgeId: any = null;
  allowed: any[] = [];
  noticeOpen=false; noticeTitle=''; noticeMsg=''; noticeErr=false;
  get isHead() { return this.auth.isHead(); }

  ngOnInit() { this.load(); }
  load() {
    const init = () => {
      this.contest = this.state.activeContest;
      if (this.contest) {
        this.allowed = getAllowedPenalties(this.contest);
        if (!this.selectedJudgeId && this.contest.judges.length) this.selectedJudgeId = this.contest.judges[0].id;
      }
    };
    if (this.state.state()) init(); else this.state.loadFromBackend().subscribe(()=> init());
    this.state.refreshContests().subscribe(()=> init());
  }
  render() {}
  getScore(cid:number, critId:number) { return this.contest?.scores?.[String(this.selectedJudgeId)]?.[String(cid)]?.criteria?.[String(critId)] ?? ''; }
  getPenalty(cid:number) { return getPenaltyTotal(this.contest, this.selectedJudgeId, cid); }
  isChecked(cid:number, pid:number) { return getSelectedPenaltyIds(this.contest, this.selectedJudgeId, cid).some(id=> String(id)===String(pid)); }
  getNet(cid:number) {
    let w=0; this.contest.criteria.forEach((crit:any)=> { const raw=parseFloat(this.getScore(cid, crit.id) as any)||0; w+= raw; });
    return Math.max(0, w - this.getPenalty(cid));
  }
  onOverrideScore(cid:number, critId:number, val:any) {
    if (!this.isHead) return;
    const w = getCriterionWeight(this.contest, critId);
    let num = parseFloat(val); if (isNaN(num)) num=0; num=Math.round(num*100)/100; num=Math.min(w,Math.max(0,num));
    const criteria:any={}; criteria[String(critId)]=num;
    this.api.putScore(this.contest.id, { judgeId: this.selectedJudgeId, contestantId: cid, criteria }).subscribe({
      next: (entry)=> {
        if (!this.contest.scores[String(this.selectedJudgeId)]) this.contest.scores[String(this.selectedJudgeId)]={};
        if (!this.contest.scores[String(this.selectedJudgeId)][String(cid)]) this.contest.scores[String(this.selectedJudgeId)][String(cid)]={ criteria:{}, penalties:[], penalty:0 };
        this.contest.scores[String(this.selectedJudgeId)][String(cid)].criteria[String(critId)]=num;
        if (entry) Object.assign(this.contest.scores[String(this.selectedJudgeId)][String(cid)], entry);
      },
      error: (e)=> { this.noticeTitle='Override Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
  onPenalty(cid:number, pid:number, checked:boolean) {
    if (!this.isHead) return;
    const cur = new Set(getSelectedPenaltyIds(this.contest, this.selectedJudgeId, cid).map(String));
    if (checked) cur.add(String(pid)); else cur.delete(String(pid));
    const arr = Array.from(cur).map(v=> { const f=this.allowed.find((r:any)=> String(r.id)===String(v)); return f?f.id:v; });
    this.api.putScore(this.contest.id, { judgeId: this.selectedJudgeId, contestantId: cid, penalties: arr as any }).subscribe({
      next: (entry)=> {
        if (!this.contest.scores[String(this.selectedJudgeId)]) this.contest.scores[String(this.selectedJudgeId)]={};
        if (!this.contest.scores[String(this.selectedJudgeId)][String(cid)]) this.contest.scores[String(this.selectedJudgeId)][String(cid)]={ criteria:{}, penalties:[], penalty:0 };
        this.contest.scores[String(this.selectedJudgeId)][String(cid)].penalties = arr as any;
        this.contest.scores[String(this.selectedJudgeId)][String(cid)].penalty = (entry as any)?.penalty ?? 0;
      },
      error: (e)=> { this.noticeTitle='Penalty Override Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
}
