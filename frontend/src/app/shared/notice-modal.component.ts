import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notice-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div *ngIf="open" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-100 text-center">
      <div class="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" [ngClass]="isError ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-700'">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ message }}</p>
      </div>
      <button (click)="close.emit()" class="w-full py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs transition shadow-sm">Understood</button>
    </div>
  </div>
  `
})
export class NoticeModalComponent {
  @Input() open = false;
  @Input() title = 'System Notification';
  @Input() message = '';
  @Input() isError = false;
  @Output() close = new EventEmitter<void>();
}
