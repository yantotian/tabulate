import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NoticeModalComponent } from '../../shared/notice-modal.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal.component';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, NoticeModalComponent, ConfirmModalComponent],
  template: `
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5">
    <div class="flex flex-wrap items-center justify-between border-b border-slate-100 pb-5 gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-indigo-950">Head Tabulator Exclusive</span>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900">System Transaction &amp; Activity Log</h2>
        </div>
        <p class="text-xs text-slate-500 mt-1">Immutable forensic audit trail capturing all user actions, score entries, overrides, and administrative changes.</p>
      </div>
      <div class="flex items-center gap-2">
        <button (click)="exportCSV()" class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Export Logs (CSV)</span>
        </button>
        <button (click)="confirmClear()" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span>Clear Logs</span>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="sm:col-span-2">
        <div class="relative">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </span>
          <input [(ngModel)]="search" (ngModelChange)="apply()" placeholder="Search by actor, contestant, action, or details..." class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-600 focus:outline-none" />
        </div>
      </div>
      <div>
        <select [(ngModel)]="roleFilter" (ngModelChange)="apply()" class="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-600 focus:outline-none">
          <option value="ALL">Filter by All Roles</option>
          <option value="Head Tabulator">Head Tabulator Only</option>
          <option value="Assistant Tabulator">Assistant Tabulator Only</option>
          <option value="Judge">Judge Only</option>
        </select>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left border-collapse text-xs">
        <thead class="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider">
          <tr>
            <th class="py-3 px-4 w-44">Timestamp</th>
            <th class="py-3 px-3 w-40">Actor</th>
            <th class="py-3 px-3 w-36">Role</th>
            <th class="py-3 px-3 w-48">Action Category</th>
            <th class="py-3 px-4">Transaction Details</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
          <tr *ngFor="let log of filtered">
            <td class="py-2.5 px-4 text-[11px] text-slate-500 font-mono">{{ log.formattedTime }}</td>
            <td class="py-2.5 px-3 font-bold">{{ log.actor }}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border" [ngClass]="log.role==='Head Tabulator' ? 'bg-amber-100 text-amber-800 border-amber-200' : log.role==='Judge' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'">{{ log.role }}</span>
            </td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold" [ngClass]="log.category?.includes('Override') ? 'bg-rose-100 text-rose-700' : log.category?.includes('Score') ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'">{{ log.category }}</span>
            </td>
            <td class="py-2.5 px-4 text-slate-600">{{ log.details }}</td>
          </tr>
          <tr *ngIf="filtered.length===0"><td colspan="5" class="py-8 text-center text-slate-400">No log entries match your filter.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="flex justify-between items-center text-xs text-slate-400 pt-2">
      <span>Showing {{ filtered.length }} entries</span>
      <span>Audit storage persists server-side</span>
    </div>
  </div>
  <app-notice-modal [open]="noticeOpen" [title]="noticeTitle" [message]="noticeMsg" [isError]="noticeErr" (close)="noticeOpen=false"></app-notice-modal>
  <app-confirm-modal [open]="confirmOpen" [title]="confirmTitle" [message]="confirmMsg" (close)="onConfirm($event)"></app-confirm-modal>
  `
})
export class AuditLogsComponent implements OnInit {
  api = inject(ApiService);
  logs: any[] = [];
  filtered: any[] = [];
  search=''; roleFilter='ALL';
  noticeOpen=false; noticeTitle=''; noticeMsg=''; noticeErr=false;
  confirmOpen=false; confirmTitle=''; confirmMsg='';

  ngOnInit() { this.load(); }
  load() {
    this.api.getAuditLogs().subscribe({
      next: (d:any)=> { this.logs = d || []; this.apply(); },
      error: (e)=> { this.noticeTitle='Load Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
  apply() {
    this.filtered = this.logs.filter(l=> {
      const s = this.search.toLowerCase();
      const matchSearch = !s || (l.actor?.toLowerCase().includes(s) || l.category?.toLowerCase().includes(s) || l.details?.toLowerCase().includes(s));
      const matchRole = this.roleFilter==='ALL' || l.role===this.roleFilter;
      return matchSearch && matchRole;
    });
  }
  exportCSV() {
    const headers = ['Timestamp','Actor','Role','Category','Details'];
    const rows = this.filtered.map(l=> [`"${l.formattedTime}"`, `"${l.actor}"`, `"${l.role}"`, `"${l.category}"`, `"${(l.details||'').replace(/"/g,'""')}"`]);
    const csv = [headers.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv' }); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='audit_logs.csv'; a.click(); URL.revokeObjectURL(url);
  }
  confirmClear() {
    this.confirmTitle='Clear Audit Logs'; this.confirmMsg='Are you sure you want to permanently clear all system audit logs? This cannot be undone.'; this.confirmOpen=true;
  }
  onConfirm(ok:boolean) {
    this.confirmOpen=false;
    if (!ok) return;
    this.api.clearAuditLogs().subscribe({
      next: ()=> { this.logs=[]; this.filtered=[]; this.noticeTitle='Logs Cleared'; this.noticeMsg='Audit logs have been cleared.'; this.noticeOpen=true; },
      error: (e)=> { this.noticeTitle='Clear Failed'; this.noticeMsg=e?.error?.error||e.message; this.noticeErr=true; this.noticeOpen=true; }
    });
  }
}
