import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ShellComponent } from './features/shell/shell.component';
import { ScorecardComponent } from './features/judge/scorecard.component';
import { SetupComponent } from './features/tabulator/setup.component';
import { AuditComponent } from './features/tabulator/audit.component';
import { LeaderboardComponent } from './features/tabulator/leaderboard.component';
import { AuditLogsComponent } from './features/tabulator/audit-logs.component';
import { authGuard, headGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'setup', pathMatch: 'full' },
      { path: 'judge', component: ScorecardComponent },
      { path: 'setup', component: SetupComponent },
      { path: 'audit', component: AuditComponent },
      { path: 'leaderboard', component: LeaderboardComponent },
      { path: 'audit-logs', component: AuditLogsComponent, canActivate: [headGuard] },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
