import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div *ngIf="open" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-100 text-center">
      <div class="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-rose-50 text-rose-600">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-900">{{ title }}</h3>
        <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ message }}</p>
      </div>
      <div class="flex items-center gap-2 pt-1">
        <button (click)="close.emit(false)" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition">Cancel</button>
        <button (click)="close.emit(true)" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-sm">Proceed</button>
      </div>
    </div>
  </div>
  `
})
export class ConfirmModalComponent {
  @Input() open = false;
  @Input() title = 'Confirm Action';
  @Input() message = '';
  @Output() close = new EventEmitter<boolean>();
}
