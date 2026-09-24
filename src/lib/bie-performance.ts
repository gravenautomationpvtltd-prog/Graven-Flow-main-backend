import { differenceInCalendarDays, isBefore, parseISO, startOfDay } from 'date-fns';
import type { BIERow } from '@/hooks/useBIEWork';

export type BIEMemberStats = {
  id: string;
  name: string;
  email: string | null;
  assigned: number;
  open: number;
  overdue: number;
  inReview: number;
  completed: number;
  reworked: number;
  completionRate: number | null;
  onTimeRate: number | null;
  reworkRate: number | null;
  avgTurnaround: number | null;
};

export type BIETeamAverages = {
  completed: number;
  avgTurnaround: number | null;
  completionRate: number | null;
  onTimeRate: number | null;
  reworkRate: number | null;
};

export const isRowOverdue = (row: BIERow) =>
  !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

const turnaround = (row: BIERow) =>
  Math.max(0, differenceInCalendarDays(new Date(row.completed_at as string), new Date(row.created_at)));

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export function memberStats(
  member: { id: string; full_name: string | null; email: string | null },
  rows: BIERow[],
): BIEMemberStats {
  const mine = rows.filter((row) => row.assigned_to === member.id);
  const done = mine.filter((row) => row.completed_at);
  const onTime = done.filter((row) => !row.due_date || !isBefore(parseISO(row.due_date), new Date(row.completed_at as string)));
  const reworked = mine.filter((row) => row.review_status === 'rework');

  return {
    id: member.id,
    name: member.full_name || member.email || 'Team member',
    email: member.email,
    assigned: mine.length,
    open: mine.filter((row) => !row.completed_at).length,
    overdue: mine.filter(isRowOverdue).length,
    inReview: mine.filter((row) => row.review_status === 'submitted').length,
    completed: done.length,
    reworked: reworked.length,
    completionRate: mine.length ? (done.length / mine.length) * 100 : null,
    onTimeRate: done.length ? (onTime.length / done.length) * 100 : null,
    reworkRate: mine.length ? (reworked.length / mine.length) * 100 : null,
    avgTurnaround: mean(done.map(turnaround)),
  };
}

export function teamAverages(stats: BIEMemberStats[]): BIETeamAverages {
  const active = stats.filter((row) => row.assigned > 0);
  return {
    completed: mean(active.map((row) => row.completed)) ?? 0,
    avgTurnaround: mean(active.filter((r) => r.avgTurnaround !== null).map((r) => r.avgTurnaround as number)),
    completionRate: mean(active.filter((r) => r.completionRate !== null).map((r) => r.completionRate as number)),
    onTimeRate: mean(active.filter((r) => r.onTimeRate !== null).map((r) => r.onTimeRate as number)),
    reworkRate: mean(active.filter((r) => r.reworkRate !== null).map((r) => r.reworkRate as number)),
  };
}

/** Difference against the team average, as a percentage of that average. */
export function compareToTeam(value: number | null, average: number | null) {
  if (value === null || average === null || average === 0) return null;
  return ((value - average) / average) * 100;
}

export const fmtNumber = (value: number | null, suffix = '') =>
  value === null || Number.isNaN(value) ? '—' : `${value.toFixed(1)}${suffix}`;
