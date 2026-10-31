import type { Goal } from './types';
import { goalDirection } from './goal-constants';

// Baseline, aim line and mastery criteria for a goal (set in Edit Goal).
// - The aim line runs from the baseline (at the baseline date, or the first session) to the target at the goal's
//   target date: where the student would need to be on each day to meet the goal on time.
// - Data-based decision rule: when the last 3 sessions are all on the wrong side of the aim line the student is
//   "Behind" (time to look at the instruction); otherwise "On track".
// - Mastery: the target met in this many sessions in a row (3 unless the goal says otherwise).

export const DEFAULT_MASTERY_SESSIONS = 3;
export const AIM_RULE_SESSIONS = 3;

export function masterySessions(goal: Goal): number {
  const n = Math.round(Number(goal.masterySessions));
  return n >= 1 && n <= 20 ? n : DEFAULT_MASTERY_SESSIONS;
}

/** A date-only value (YYYY-MM-DD) or an ISO date as a time in ms, read in local time for date-only values. */
export function dateValue(value: string): number {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value).getTime();
}

export interface AimLine {
  start: { time: number; value: number };
  end: { time: number; value: number };
}

/** The goal's aim line, or null without a baseline, a target and a target date (or when they don't make a line). */
export function aimLine(goal: Goal, firstSessionDate?: string): AimLine | null {
  const target = goal.sessionTargetValue;
  if (goal.baseline === undefined || goal.baseline === null || target === undefined || !goal.targetDate) return null;
  const startDate = goal.baselineDate || firstSessionDate;
  if (!startDate) return null;
  const start = dateValue(startDate);
  const end = dateValue(goal.targetDate);
  if (!(end > start)) return null;
  return { start: { time: start, value: Number(goal.baseline) }, end: { time: end, value: target } };
}

/** The aim line's value on a date (held at the target after the target date). */
export function aimValueAt(aim: AimLine, date: string | number): number {
  const t = typeof date === 'number' ? date : dateValue(date);
  if (t <= aim.start.time) return aim.start.value;
  if (t >= aim.end.time) return aim.end.value;
  const share = (t - aim.start.time) / (aim.end.time - aim.start.time);
  return aim.start.value + share * (aim.end.value - aim.start.value);
}

export type AimStatus = 'on-track' | 'behind';

/** On track, or behind when the last 3 sessions all fell short of the aim line (null without an aim line or data). */
export function aimStatus(goal: Goal, aim: AimLine | null, points: { date: string; value: number }[]): AimStatus | null {
  if (!aim || points.length === 0) return null;
  const decrease = goalDirection(goal) === 'decrease';
  const short = (p: { date: string; value: number }) => {
    const expected = aimValueAt(aim, p.date);
    return decrease ? p.value > expected + 1e-9 : p.value < expected - 1e-9;
  };
  const last = points.slice(-AIM_RULE_SESSIONS);
  return last.length === AIM_RULE_SESSIONS && last.every(short) ? 'behind' : 'on-track';
}

export const AIM_STATUS_LABELS: Record<AimStatus, string> = {
  'on-track': 'On track',
  behind: 'Behind the aim line',
};
