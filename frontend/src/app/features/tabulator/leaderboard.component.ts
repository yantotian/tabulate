import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/state.service';
import { ApiService } from '../../core/api.service';
import { calculateContestResults } from '../../core/contest-utils';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section *ngIf="contest" class="space-y-6 printable-area">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
      <div class="flex flex-wrap items-center justify-between border-b border-slate-200 pb-5 mb-6 gap-4">
        <div>
          <span class="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 no-print">Certified Results</span>
          <h1 class="text-2xl sm:text-3xl font-black text-slate-900 mt-1 uppercase tracking-tight">{{ contest.title }}</h1>
          <p class="text-xs text-slate-500 mt-0.5">Rankings computed across all evaluated criteria and judges with penalties factored in.</p>
        </div>
        <div class="flex items-center gap-2.5 no-print">
          <button (click)="print()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>Print Tabulation</span>
          </button>
          <button (click)="exportCSV()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase tracking-wider">
            <tr>
              <th class="py-3 px-4">Rank</th>
              <th class="py-3 px-4">Contestant / Team</th>
              <th *ngFor="let j of contest.judges" class="py-3 px-3 text-center">{{ j.name }}</th>
              <th class="py-3 px-3 text-center">Total Penalties</th>
              <th class="py-3 px-4 text-right">Final Net Score</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let r of results; let i=index" [ngClass]="i===0 ? 'bg-amber-50/60' : ''">
              <td class="py-3 px-4 font-black">
                <span class="inline-flex items-center gap-1">
                  <span *ngIf="i===0">🥇</span><span *ngIf="i===1">🥈</span><span *ngIf="i===2">🥉</span>
                  #{{ i+1 }}
                </span>
              </td>
              <td class="py-3 px-4 font-bold text-slate-900">{{ r.name }}</td>
              <td *ngFor="let jt of r.judgeTotals" class="py-3 px-3 text-center font-semibold">{{ jt | number:'1.2-2' }}</td>
              <td class="py-3 px-3 text-center text-rose-600 font-bold">-{{ r.totalPenalties | number:'1.2-2' }}</td>
              <td class="py-3 px-4 text-right font-black text-indigo-700">{{ r.finalScore | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 text-xs text-slate-500">
        <div>
          <p class="font-bold text-slate-800 text-sm">Official Certification of Results</p>
          <p>We certify that this tabulation has been verified, accurately calculated, and audited in compliance with event bylaws.</p>
          <p class="mt-2 text-[11px] text-slate-400">{{ now }}</p>
        </div>
        <div class="text-center w-64">
          <div class="border-b border-slate-800 pb-1 mb-1"><div class="h-10"></div><span class="font-bold text-sm text-slate-800 uppercase">Head Tabulator</span></div>
          <p class="text-[11px] text-slate-400">Audited &amp; Verified By</p>
        </div>
      </div>
    </div>
  </section>
  `
})
export class LeaderboardComponent implements OnInit {
  state = inject(StateService);
  api = inject(ApiService);
  contest: any = null;
  results: any[] = [];
  now = new Date().toLocaleString();

  ngOnInit() {
    const init = () => {
      this.contest = this.state.activeContest;
      if (this.contest) {
        // Prefer backend computed leaderboard, fallback to local calc
        this.api.getLeaderboard(this.contest.id).subscribe({
          next: (res: any) => {
            if (res?.results) {
              this.results = res.results.map((r:any)=> ({ ...r, finalScore: r.finalScore, judgeTotals: r.judgeTotals, totalPenalties: r.totalPenalties }));
            } else this.results = calculateContestResults(this.contest);
          },
          error: () => this.results = calculateContestResults(this.contest)
        });
      }
    };
    if (this.state.state()) init(); else this.state.loadFromBackend().subscribe(()=> init());
    this.state.refreshContests().subscribe(()=> init());
  }
  print() { window.print(); }
  exportCSV() {
    const headers = ['Rank','Contestant', ...this.contest.judges.map((j:any)=> j.name), 'Total Penalties','Final Score'];
    const rows = this.results.map((r,i)=> [i+1, `"${r.name}"`, ...r.judgeTotals.map((v:any)=> v.toFixed(2)), r.totalPenalties.toFixed(2), r.finalScore.toFixed(2)]);
    const csv = [headers.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${this.contest.title.replace(/\s+/g,'_')}_tabulation.csv`; a.click(); URL.revokeObjectURL(url);
  }
}
