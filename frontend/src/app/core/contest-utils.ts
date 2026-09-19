import { Contest } from '../models/app-state.model';

export function getAllowedPenalties(contest: Contest | null | undefined) {
  if (!contest || !Array.isArray(contest.penalties)) return [];
  return contest.penalties;
}
export function isPenaltyAllowed(contest: Contest, penaltyId: number | string): boolean {
  return getAllowedPenalties(contest).some((p: any) => String(p.id) === String(penaltyId));
}
export function calculatePenaltyDeduction(contest: Contest, ids: (number | string)[]): number {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  return (ids as any[]).reduce((sum: number, pid: any) => {
    const rule = getAllowedPenalties(contest).find((p: any) => String(p.id) === String(pid));
    return sum + (rule ? parseFloat(String((rule as any).defaultDeduction)) || 0 : 0);
  }, 0 as number);
}
export function getSelectedPenaltyIds(contest: Contest, judgeId: number | string, contestantId: number | string): (number | string)[] {
  const entry = (contest.scores as any)?.[String(judgeId)]?.[String(contestantId)];
  if (!entry) return [];
  if (Array.isArray(entry.penalties)) return entry.penalties.filter((pid: any) => isPenaltyAllowed(contest, pid));
  if (Array.isArray((entry as any).penaltyIds)) return (entry as any).penaltyIds.filter((pid: any) => isPenaltyAllowed(contest, pid));
  return [];
}
export function getPenaltyTotal(contest: Contest, judgeId: number | string, contestantId: number | string): number {
  const entry = (contest.scores as any)?.[String(judgeId)]?.[String(contestantId)];
  const sel = getSelectedPenaltyIds(contest, judgeId, contestantId);
  if (sel.length > 0) return calculatePenaltyDeduction(contest, sel);
  if (entry && entry.penalty !== undefined && entry.penalty !== '' && entry.penalty !== null) return parseFloat(String(entry.penalty)) || 0;
  return 0;
}
export function getCriterionWeight(contest: Contest, cid: number | string): number {
  if (!contest || !Array.isArray(contest.criteria)) return 100;
  const crit = contest.criteria.find((c: any) => String(c.id) === String(cid));
  return crit ? parseFloat(String((crit as any).weight)) || 0 : 100;
}
export function calculateContestResults(contest: Contest) {
  const results = contest.contestants.map((c) => {
    let judgeTotals: number[] = [];
    let totalDeductions = 0;
    contest.judges.forEach((j) => {
      let jSum = 0;
      contest.criteria.forEach((crit) => {
        const raw = (contest.scores as any)?.[j.id]?.[c.id]?.criteria?.[crit.id];
        jSum += (parseFloat(String(raw)) || 0);
      });
      const penalty = getPenaltyTotal(contest, j.id, c.id);
      totalDeductions += penalty;
      judgeTotals.push(Math.max(0, jSum - penalty));
    });
    const finalScore = judgeTotals.length ? judgeTotals.reduce((a, b) => a + b, 0) / judgeTotals.length : 0;
    return { id: c.id, name: c.name, judgeTotals, totalPenalties: totalDeductions, finalScore };
  });
  results.sort((a, b) => b.finalScore - a.finalScore);
  return results;
}
export function hasContestAccess(contest: Contest, user: any): boolean {
  if (!contest || !user) return false;
  if (user.role === 'judge') return String(user.contestId) === String(contest.id);
  if (user.isHead) return true;
  const isCreator = String(contest.createdByTabulatorId) === String(user.tabulatorId);
  const isAssigned = Array.isArray(contest.assignedTabulatorIds) && contest.assignedTabulatorIds.includes(user.tabulatorId);
  return isCreator || isAssigned;
}
