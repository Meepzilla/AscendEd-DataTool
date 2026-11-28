import type { CustomGoalType } from './types';
import {
  captureTypeOf, commUsesMinimum, goalDirection, summarizeCommunicationFunctions, toolTypeOf,
} from './goal-constants';
import { PROMPT_TYPES } from './promptConstants';
import { getGoalTypeDef, type MeasuredGoal } from './goal-types';

// The one number each goal is measured by in a session, so every goal type can be charted against its
// target: accuracy % for trial-based goals, story score %, number of functions used spontaneously,
// a 1-5 rating, % independent, the behavior measures (count, minutes, %, seconds), and user-made custom types.

export interface GoalMeasureInfo {
  label: string;
  unit: string; // appended to values, e.g. '%', ' min'
  max?: number; // fixed top of the chart scale, when there is one
  min?: number; // fixed bottom of the chart scale, when it isn't 0 (GAS levels run -2 to +2)
}

/** Correct, incorrect and approximate responses for the trial-based goal types; null for other types. */
export function goalResponses(
  typeOrGoal: string | MeasuredGoal | { type: string; dataCaptureType?: string; customType?: CustomGoalType },
  data: Record<string, any> = {},
): { correct: number; incorrect: number; approximate: number } | null {
  if (typeof typeOrGoal === 'string' && typeOrGoal === 'CUSTOM') {
    if ('correct' in data || 'incorrect' in data) {
      const n = (v: unknown) => { const num = Number(v); return Number.isFinite(num) ? Math.max(0, num) : 0; };
      return { correct: n(data.correct), incorrect: n(data.incorrect), approximate: n(data.approximate) };
    }
    return null;
  }
  return getGoalTypeDef(typeOrGoal).responses(data);
}

export function promptTotals(data: Record<string, any> = {}): Record<string, number> {
  return Object.fromEntries(PROMPT_TYPES.map(p => [p, Math.max(0, Number(data[p]) || 0)]));
}

export function goalMeasureInfo(goal: MeasuredGoal): GoalMeasureInfo {
  return getGoalTypeDef(goal).measureInfo(goal);
}

/**
 * A saved session's data with any timer that was left running cleared. Saving stops timers, but a running
 * one would otherwise keep counting until the day the report is viewed (e.g. a duration "episode" of weeks).
 */
export function withoutRunningTimers(data: Record<string, any>): Record<string, any> {
  return data.runningSince || data.cueGivenAt || data.timerStartedAt
    ? { ...data, runningSince: null, cueGivenAt: null, timerStartedAt: null }
    : data;
}

/**
 * A goal's measure for one session's data, or null when nothing was recorded for it (every session stores
 * all of a student's goals, so untouched goals are left out of charts rather than shown as 0%).
 */
export function goalMeasure(goal: MeasuredGoal, data: Record<string, any> = {}): number | null {
  return getGoalTypeDef(goal).measure(goal, data);
}

/**
 * Whether a session's measure meets the goal's target (at or below it for decrease goals). The measure is
 * compared as it is shown (to 0.1), so a value shown as "5" never reads as missing a target of 5.
 */
export function meetsTarget(goal: MeasuredGoal, value: number, target: number): boolean {
  const shown = Math.round(value * 10) / 10;
  return goalDirection(goal) === 'decrease' ? shown <= target : shown >= target;
}

/**
 * Whether one session's data met the goal's target. For most goal types this is meetsTarget on the
 * session's measure. A Communication Functions goal can also carry a minimum total of unprompted uses
 * (sessionTargetUses, counting spontaneous and emerging forms together), for goals worded "at least 5
 * times for at least 2 different functions": the session then counts only when it reaches the functions
 * target and the uses minimum together (a goal measured by total uses ignores the minimum). A session with no
 * measure never met the target.
 */
export function sessionMeetsTarget(goal: MeasuredGoal, data: Record<string, any>, target: number): boolean {
  const value = goalMeasure(goal, data);
  if (value === null || !meetsTarget(goal, value, target)) return false;
  if (toolTypeOf(captureTypeOf(goal)) === 'COMMUNICATION_FUNCTIONS') {
    // A goal measured by total uses has no separate minimum: its measure is already the uses.
    const uses = commUsesMinimum(goal);
    if (uses > 0) return summarizeCommunicationFunctions(data).unprompted >= uses;
  }
  return true;
}

export function usesPromptCounters(typeOrGoal: string | MeasuredGoal): boolean {
  return getGoalTypeDef(typeOrGoal).usesPromptCounters;
}

/** True for built-in latency goals (BEHAVIOR_LATENCY / RESPONSE_TIME) and custom latency goals. */
export function isLatencyGoal(goal: MeasuredGoal): boolean {
  const type = captureTypeOf(goal);
  return toolTypeOf(type) === 'BEHAVIOR_LATENCY' || (type === 'CUSTOM' && goal.customType?.kind === 'latency');
}

/** A session's free-text notes for a goal, whichever field the goal type uses. */
export function goalNotes(data: Record<string, any> = {}): string {
  return [data.notes, data.details, data.observationNotes].map(v => String(v ?? '').trim()).filter(Boolean).join(' · ');
}
