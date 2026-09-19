export interface Criterion { id: number; name: string; weight: number; }
export interface PenaltyRule { id: number; name: string; defaultDeduction: number; }
export interface Contestant { id: number; name: string; }
export interface Judge { id: number; name: string; password?: string; }
export interface ScoreEntry {
  criteria: Record<string, number>;
  penalties: (number | string)[];
  penalty: number;
}
export type Scores = Record<string, Record<string, ScoreEntry>>;

export interface Contest {
  id: string;
  title: string;
  createdByTabulatorId: string;
  createdByName: string;
  assignedTabulatorIds: string[];
  criteria: Criterion[];
  penalties: PenaltyRule[];
  contestants: Contestant[];
  judges: Judge[];
  scores: Scores;
}

export interface Tabulator { id: string; username: string; name: string; password?: string; isHead: boolean; }

export interface AuditLog {
  id: string; timestamp: string; formattedTime: string;
  actor: string; role: string; category: string; details: string;
}

export interface AppState {
  tabulators: Tabulator[];
  activeContestId: string;
  auditLogs: AuditLog[];
  contests: Contest[];
}

export interface PublicContest { id: string; title: string; judges: { id: number; name: string }[]; contestants: { id: number; name: string }[]; penalties: PenaltyRule[]; }

export type AuthRole = 'tabulator' | 'judge';
export interface TabulatorUser { role: 'tabulator'; tabulatorId: string; username: string; name: string; isHead: boolean; }
export interface JudgeUser { role: 'judge'; contestId: string; judgeId: number; name: string; }
export type AuthUser = TabulatorUser | JudgeUser;

export interface LeaderboardEntry {
  id: number; name: string; judgeTotals: number[]; totalPenalties: number; finalScore: number; rank?: number;
}
