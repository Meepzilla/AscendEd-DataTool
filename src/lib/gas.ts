import type { Goal, SessionData } from './types';
import { compareSessionsOldestFirst, parseDateOnly } from './helpers';

// Goal Attainment Scaling: five levels, -2 (much less than expected) to +2 (much more than expected),
// with 0 the expected outcome. The composite T-score is a per-student, per-date figure over all the
// student's GAS goals, so it lives here rather than in goalMeasure (which is one number per goal).

export type GasLevel = -2 | -1 | 0 | 1 | 2;

/** One attainment level: the number as shown, its short label, and its generic description. */
export interface GasLevelInfo {
  level: GasLevel;
  label: string;
  description: string;
}

export const GAS_LEVELS: GasLevelInfo[] = [
  { level: -2, label: 'Much less', description: 'Much less than expected' },
  { level: -1, label: 'Somewhat less', description: 'Somewhat less than expected' },
  { level: 0, label: 'Expected', description: 'Expected outcome' },
  { level: 1, label: 'Somewhat more', description: 'Somewhat more than expected' },
  { level: 2, label: 'Much more', description: 'Much more than expected' },
];

const GAS_LEVEL_BY_VALUE: Record<number, GasLevelInfo> = Object.fromEntries(GAS_LEVELS.map(info => [info.level, info]));

/** The number as shown on a picker button and in the accuracy line: +1, 0, -2. */
export function formatGasLevel(level: number): string {
  return level > 0 ? `+${level}` : `${level}`;
}

/** A level with its generic label: "+1 (somewhat more than expected)", "0 (expected outcome)". */
export function gasLevelLabel(level: number): string {
  const info = GAS_LEVEL_BY_VALUE[level];
  return info ? `${formatGasLevel(level)} (${info.description.toLowerCase()})` : formatGasLevel(level);
}

/**
 * Progress (0-100) toward a GAS target, from the bottom of the scale (-2): with the usual target of 0 (the expected
 * outcome), level 0 or above is 100, -1 is 50 and -2 is 0. Never negative.
 */
export function gasProgress(level: number, target = 0): number {
  const floor = -2;
  if (level >= target) return 100;
  if (target <= floor) return 0;
  return Math.max(0, Math.min(100, ((level - floor) / (target - floor)) * 100));
}

/** The correlation between goals in the T-score formula (Kiresuk & Sherman). */
export const GAS_RHO = 0.3;

/**
 * The composite T-score for a set of attained levels (equal weights, rho = 0.3):
 * T = 50 + 10 * sum(x_i) / sqrt((1 - rho) * n + rho * n^2). Null with no levels yet.
 * One goal at level 0 gives 50; one at +2 gives 70; three goals all at +1 give 63.7.
 */
export function gasTScore(levels: number[]): number | null {
  if (levels.length === 0) return null;
  const n = levels.length;
  const sum = levels.reduce((a, b) => a + b, 0);
  const denominator = Math.sqrt((1 - GAS_RHO) * n + GAS_RHO * n * n);
  return Math.round((50 + (10 * sum) / denominator) * 10) / 10;
}

export interface GasTScorePoint {
  /** The session date (YYYY-MM-DD). */
  date: string;
  /** The composite T-score that day, or null when no GAS goal had a level yet. */
  tScore: number | null;
  /** Each goal's level that day, by goal id. */
  levels: Record<string, number>;
}

/**
 * One T-score per session date, carry-forward: each goal contributes its latest recorded level on or
 * before that date, and goals with no level yet are left out. A goal not worked on in a session keeps
 * its last level rather than dropping out of the composite.
 */
export function gasTScoresOverTime(sessions: SessionData[], gasGoals: Pick<Goal, 'id'>[]): GasTScorePoint[] {
  const ordered = [...sessions].sort(compareSessionsOldestFirst);
  const dates = [...new Set(ordered.map(s => s.date))];
  return dates.map(date => {
    const cutoff = parseDateOnly(date).getTime();
    const levels: Record<string, number> = {};
    for (const goal of gasGoals) {
      for (const session of ordered) {
        if (parseDateOnly(session.date).getTime() > cutoff) break;
        const level = session.goals?.find(g => g.goalId === goal.id)?.data?.gasLevel;
        if (typeof level === 'number' && level >= -2 && level <= 2) levels[goal.id] = level;
      }
    }
    return { date, tScore: gasTScore(Object.values(levels)), levels };
  });
}
