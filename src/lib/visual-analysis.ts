import type { TargetDirection } from './types';

// Visual analysis of session-to-session data, as single-subject design describes it (Sohlberg, Hamilton &
// Turkstra, Transforming Cognitive Rehabilitation, ch. 5; Lane & Gast, 2014). With treatment data only, the
// sessions are split at the halfway point: the first half is Phase A, the second half Phase B. Each phase is
// described by its level (the median), its trend (a line through the middle of the data) and its stability
// (the range from lowest to highest). Splitting at the halfway point every time keeps the comparison
// predictable and unbiased: nobody chooses which sessions go where.
//
// Trend lines use the Theil-Sen method: the slope is the median of the slopes between every pair of sessions,
// so about half the points fall above the line and half below, and one unusual session barely moves it. For
// the book's worked example (30 40 30 50 40 | 60 60 80 70 80) it gives the book's figures: medians 40 and 70,
// slopes 3.75 and 5.0 per session, ranges 30-50 and 60-80, and 5.0 per session overall.

/** Fewer sessions than this and the halves are too small to compare. */
export const MIN_ANALYSIS_SESSIONS = 4;
/** The book's minimum for a reliable analysis of gains from treatment data only. */
export const RELIABLE_ANALYSIS_SESSIONS = 10;

export interface PhaseSummary {
  /** Index of the phase's first and last session in the values given (inclusive). */
  first: number;
  last: number;
  count: number;
  /** Level: the median of the phase. */
  median: number;
  /** Trend: change per session, and the line's value at the phase's first session. */
  slope: number;
  start: number;
  /** Stability: the lowest and highest values, and the difference. */
  min: number;
  max: number;
  range: number;
}

export interface VisualAnalysis {
  phaseA: PhaseSummary;
  phaseB: PhaseSummary;
  /** Median of Phase B minus median of Phase A. */
  levelChange: number;
  /** Change per session over all sessions (Theil-Sen slope). */
  averageChange: number;
  /** Whether the change is in the goal's direction ('better'), against it ('worse'), or neither ('flat'). */
  levelVerdict: 'better' | 'worse' | 'flat';
  trendVerdict: 'better' | 'worse' | 'flat';
  /** About how many more sessions to reach the target at the average change; 0 when the latest session meets it;
      null without a target or when the data are not moving toward it. */
  sessionsToTarget: number | null;
  /** Fewer sessions than the book's minimum of 10: read with care. */
  fewSessions: boolean;
}

/** The middle value, or the average of the two middle values. */
export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Theil-Sen line through values at positions 0, 1, 2, …: the slope and the line's value at position 0. */
export function theilSen(values: number[]): { slope: number; intercept: number } {
  if (values.length < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const slopes: number[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) slopes.push((values[j] - values[i]) / (j - i));
  }
  const slope = medianOf(slopes);
  return { slope, intercept: medianOf(values.map((v, i) => v - slope * i)) };
}

function phase(values: number[], first: number, last: number): PhaseSummary {
  const part = values.slice(first, last + 1);
  const { slope, intercept } = theilSen(part);
  const min = Math.min(...part);
  const max = Math.max(...part);
  return { first, last, count: part.length, median: medianOf(part), slope, start: intercept, min, max, range: max - min };
}

/** A change is "flat" when it is within this share of the data's spread (or of 1 when every value is the same). */
const FLAT_SHARE = 0.05;

function verdict(change: number, direction: TargetDirection, scale: number): 'better' | 'worse' | 'flat' {
  if (Math.abs(change) <= FLAT_SHARE * scale) return 'flat';
  return (change > 0) === (direction === 'increase') ? 'better' : 'worse';
}

/**
 * Phase A / Phase B visual analysis of a goal's session values (oldest first). Null with fewer than
 * MIN_ANALYSIS_SESSIONS values. With an odd number of sessions the middle one goes to Phase B, so Phase B is
 * never the smaller half (it is the more recent picture).
 */
export function visualAnalysis(values: number[], options: { direction?: TargetDirection; target?: number } = {}): VisualAnalysis | null {
  const data = values.filter(v => Number.isFinite(v));
  if (data.length < MIN_ANALYSIS_SESSIONS) return null;
  const direction = options.direction ?? 'increase';
  const half = Math.floor(data.length / 2);
  const phaseA = phase(data, 0, half - 1);
  const phaseB = phase(data, half, data.length - 1);
  const averageChange = theilSen(data).slope;
  const spread = Math.max(...data) - Math.min(...data) || 1;
  const levelChange = phaseB.median - phaseA.median;

  let sessionsToTarget: number | null = null;
  const target = options.target;
  if (target !== undefined && Number.isFinite(target)) {
    const latest = data[data.length - 1];
    const gap = target - latest;
    const met = direction === 'increase' ? latest >= target : latest <= target;
    if (met) sessionsToTarget = 0;
    else if (averageChange !== 0 && Math.sign(averageChange) === Math.sign(gap)) sessionsToTarget = Math.ceil(gap / averageChange);
  }

  return {
    phaseA,
    phaseB,
    levelChange,
    averageChange,
    levelVerdict: verdict(levelChange, direction, spread),
    // The trend verdict compares the change over the whole data set, per session, against the spread per session.
    trendVerdict: verdict(averageChange, direction, spread / Math.max(1, data.length - 1)),
    sessionsToTarget,
    fewSessions: data.length < RELIABLE_ANALYSIS_SESSIONS,
  };
}

/** The phase lines for a chart: per value, the median and trend of the phase it is in. */
export function phaseLines(analysis: VisualAnalysis, count: number): { median: number; trend: number; phase: 'A' | 'B' }[] {
  return Array.from({ length: count }, (_, i) => {
    const p = i < analysis.phaseB.first ? analysis.phaseA : analysis.phaseB;
    return { median: p.median, trend: p.start + p.slope * (i - p.first), phase: i < analysis.phaseB.first ? 'A' : 'B' };
  });
}
