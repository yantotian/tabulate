import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/state.service';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { getPenaltyTotal, getSelectedPenaltyIds, getAllowedPenalties, getCriterionWeight } from '../../core/contest-utils';
import { NoticeModalComponent } from '../../shared/notice-modal.component';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [CommonModule, FormsModule, NoticeModalComponent],
  template: `
  <section *ngIf="contest" class="space-y-6">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 printable-area">
      <div class="flex flex-wrap items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-4">
        <div>
          <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 no-print">Judge Evaluation Sheet</span>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 mt-1 uppercase tracking-tight">{{ contest.title }}</h1>
          <p class="text-xs text-slate-500 mt-0.5">Scoring scale: 0 to weight per criterion (e.g. 15% → 0–15). Each input is direct points (max = weight, step 0.01). Penalties: judges may only select from penalties listed by admin/tabulator — deductions summed and subtracted from direct-sum total.</p>
        </div>
        <div class="flex items-center gap-3 no-print">
          <div class="text-right">
            <span class="text-xs font-bold text-slate-700 block">{{ userName }}</span>
            <span class="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Terminal Connected</span>
          </div>
          <button (click)="print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>Print / Save Scorecard</span>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            <tr>
              <th class="py-3 px-4 w-1/4">Contestant / Team</th>
              <th *ngFor="let crit of contest.criteria" class="py-3 px-3 text-center">{{ crit.name }} <span class="text-indigo-600 font-black">({{ crit.weight }}%)</span></th>
              <th class="py-3 px-3 text-center text-rose-600 font-bold">Penalties (multiple select)</th>
              <th class="py-3 px-4 text-right font-black">Net Weighted</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let c of contest.contestants" class="hover:bg-slate-50 transition">
              <td class="py-3 px-4 font-bold text-slate-900">{{ c.name }}</td>
              <td *ngFor="let crit of contest.criteria" class="py-2.5 px-3 text-center">
                <input type="number" min="0" [attr.max]="crit.weight" step="0.01" [ngModel]="getScore(c.id, crit.id)" (ngModelChange)="onScore(c.id, crit.id, $event)" [attr.placeholder]="'0–' + crit.weight" class="w-20 text-center border border-slate-300 rounded-lg py-1 px-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
              </td>
              <td class="py-2.5 px-3">
                <div *ngIf="getAllowed().length===0" class="text-xs text-slate-400 italic">No penalties defined for this contest</div>
                <div *ngIf="getAllowed().length>0" class="space-y-1.5 text-left min-w-[180px] max-w-[260px]">
                  <label *ngFor="let rule of getAllowed()" class="flex items-center gap-2 px-2 py-1 rounded-lg border cursor-pointer transition text-xs" [ngClass]="isChecked(c.id, rule.id) ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'">
                    <input type="checkbox" [checked]="isChecked(c.id, rule.id)" (change)="onPenaltyToggle(c.id, rule.id, $any($event.target).checked)" class="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300" />
                    <span class="flex-1">{{ rule.name }} <span class="font-bold">(-{{ rule.defaultDeduction }})</span></span>
                  </label>
                  <div class="text-[11px] text-rose-600 font-semibold pt-1">Total Deduction: -{{ getPenalty(c.id) }} pts</div>
                </div>
              </td>
              <td class="py-3 px-4 text-right font-black text-indigo-700">{{ getNet(c.id) | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8">
        <div class="max-w-md text-xs text-slate-500 space-y-1.5">
          <h4 class="font-bold text-slate-800 text-sm">Judge's Official Certification</h4>
          <p>I hereby certify on my honor that the evaluations, numerical scores, and deduction penalties indicated in this scorecard have been independently and judiciously rendered in strict adherence to the competition guidelines.</p>
          <p class="text-[11px] text-slate-400 pt-1 font-mono">Official Certification Timestamp: {{ now }}</p>
        </div>
        <div class="text-center w-72">
          <div class="border-b-2 border-slate-900 pb-1 mb-1.5"><div class="h-14"></div><span class="font-bold text-base text-slate-900 tracking-wide uppercase">{{ userName }}</span></div>
          <p class="text-xs text-slate-500 font-semibold tracking-wide">Signature over Printed Name (Judge)</p>
        </div>
      </div>
    </div>
  </section>
  <div *ngIf="!contest" class="bg-white rounded-2xl p-8 text-center text-slate-500">No contest available for your judge account.</div>
  <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
  `
})
export class ScorecardComponent implements OnInit {
  state = inject(StateService);
  api = inject(ApiService);
  auth = inject(AuthService);
  contest: any = null;
  now = new Date().toLocaleString();
  noticeOpen=false; noticeTitle=''; noticeMsg=''; noticeErr=false;

  get userName() { return this.auth.user()?.name || ''; }
  get judgeId() { return this.auth.user()?.judgeId; }

  ngOnInit() {
    this.load();
  }
  load() {
    const init = () => { this.contest = this.state.activeContest; this.now = new Date().toLocaleString(); };
    if (this.state.state()) init(); else this.state.loadFromBackend().subscribe(()=> init());
    this.state.refreshContests().subscribe(()=> init());
  }
  getAllowed() { return getAllowedPenalties(this.contest); }
  getScore(contestantId: number, criterionId: number) {
    return this.contest?.scores?.[String(this.judgeId)]?.[String(contestantId)]?.criteria?.[String(criterionId)] ?? '';
  }
  getPenalty(contestantId: number) { return getPenaltyTotal(this.contest, this.judgeId, contestantId); }
  isChecked(contestantId: number, pid: number) { return getSelectedPenaltyIds(this.contest, this.judgeId, contestantId).some(id => String(id)===String(pid)); }
  getNet(contestantId: number) {
    let sum = 0;
    this.contest?.criteria.forEach((crit: any) => {
      const raw = parseFloat(this.getScore(contestantId, crit.id) as any) || 0;
      sum += raw;
    });
    return Math.max(0, sum - this.getPenalty(contestantId));
  }
  onScore(contestantId: number, criterionId: number, val: any) {
    const w = getCriterionWeight(this.contest, criterionId);
    let num = parseFloat(val); if (isNaN(num)) num = 0; num = Math.round(num*100)/100; num = Math.min(w, Math.max(0, num));
    // prepare criteria map with single criterion
    const criteria: any = {}; criteria[String(criterionId)] = num;
    this.api.putScore(this.contest.id, { judgeId: this.judgeId, contestantId, criteria }).subscribe({
      next: (entry) => {
        if (!this.contest.scores[String(this.judgeId)]) this.contest.scores[String(this.judgeId)] = {};
        if (!this.contest.scores[String(this.judgeId)][String(contestantId)]) this.contest.scores[String(this.judgeId)][String(contestantId)] = { criteria: {}, penalties: [], penalty: 0 };
        this.contest.scores[String(this.judgeId)][String(contestantId)].criteria[String(criterionId)] = num;
        // update penalty total if entry has
        if (entry) Object.assign(this.contest.scores[String(this.judgeId)][String(contestantId)], entry);
      },
      error: (e) => { this.noticeTitle='Save Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
  onPenaltyToggle(contestantId: number, pid: number, checked: boolean) {
    const cur = new Set(getSelectedPenaltyIds(this.contest, this.judgeId, contestantId).map(String));
    if (checked) cur.add(String(pid)); else cur.delete(String(pid));
    const arr = Array.from(cur).map(v => {
      const found = this.getAllowed().find((r:any)=> String(r.id)===String(v));
      return found ? found.id : v;
    });
    this.api.putScore(this.contest.id, { judgeId: this.judgeId, contestantId, penalties: arr as any }).subscribe({
      next: (entry) => {
        if (!this.contest.scores[String(this.judgeId)]) this.contest.scores[String(this.judgeId)]={};
        if (!this.contest.scores[String(this.judgeId)][String(contestantId)]) this.contest.scores[String(this.judgeId)][String(contestantId)]={ criteria:{}, penalties:[], penalty:0 };
        this.contest.scores[String(this.judgeId)][String(contestantId)].penalties = arr as any;
        this.contest.scores[String(this.judgeId)][String(contestantId)].penalty = (entry as any)?.penalty ?? 0;
      },
      error: (e) => { this.noticeTitle='Penalty Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
  print() { window.print(); }
}
