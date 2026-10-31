import type { SessionData, SessionGoalData } from './types';
import { compareSessionsOldestFirst } from './helpers';
import { sessionMinutes } from './student-overview';
import { finalizeBehaviorData } from './goal-constants/behavior';
import { STORY_PARTS } from './goal-constants/story-champs';

// Sessions → Merge: records of one student's session that were saved in parts (saved, then more data collected
// and saved again) become one session. Its time runs from the earliest start to the latest end, so service
// minutes count the time once instead of once per save, and the goal data is combined:
// - counts add up (correct/incorrect, prompts, behavior counts, observation minutes, fluency counts...);
// - lists are joined (trials, ABC incidents, duration episodes, occurrence times, intervals);
// - task analysis steps keep each step's latest score; ratings, settings (interval length, interval method)
//   and other single values keep the latest; Story Champs parts keep the best score given;
// - summaries worked out from the data (% of intervals, average latency) are worked out again;
// - notes and activities are joined.
// Only sessions of the same student on the same day that took place (not missed) can be merged.

/** Why these sessions can't be merged, or null when they can. */
export function mergeProblem(sessions: SessionData[]): string | null {
  if (sessions.length < 2) return 'Select at least two sessions.';
  if (sessions.some(s => s.missed)) return 'Missed sessions can\'t be merged.';
  if (new Set(sessions.map(s => s.studentId)).size > 1) return 'Select sessions of one student.';
  if (new Set(sessions.map(s => new Date(s.date).toDateString())).size > 1) return 'Select sessions on the same day.';
  return null;
}

const joinText = (values: (string | undefined)[], separator: string) =>
  [...new Set(values.map(v => (v ?? '').trim()).filter(Boolean))].join(separator);

const toMinutes = (t?: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Numbers that are settings, times or summaries rather than counts: they keep the latest value (summaries are
// worked out again afterwards).
const NOT_ADDED = new Set(['rating', 'numberOfTrials', 'runningSince', 'intervalSeconds', 'percentIntervals', 'averageSeconds', 'timerStartedAt', 'cueGivenAt']);
const STORY_PART_KEYS = new Set<string>(STORY_PARTS.map(p => p.key));

/** Combines one goal's data from several sessions, oldest first. */
export function mergeGoalData(parts: Record<string, any>[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part ?? {})) {
      const current = result[key];
      if (current === undefined) { result[key] = Array.isArray(value) ? [...value] : value; continue; }
      if (key === 'steps' && Array.isArray(current) && Array.isArray(value)) {
        // Task analysis: each step's latest score (by position), keeping earlier scores for steps scored once.
        const length = Math.max(current.length, value.length);
        result.steps = Array.from({ length }, (_, i) => (value[i]?.level ? value[i] : current[i] ?? value[i]));
      } else if (key === 'trials' && Array.isArray(current) && Array.isArray(value)) {
        // Trial grids: every scored trial (unscored ones don't count toward anything).
        const scored = [...current, ...value].filter(t => t !== 'untouched');
        result.trials = scored.length ? scored : [...value];
      } else if (Array.isArray(current) && Array.isArray(value)) {
        result[key] = [...current, ...value];
      } else if (key === 'startedAt' && current) {
        // Interval recording: keeps when the first part's intervals began.
      } else if (typeof current === 'number' && typeof value === 'number' && STORY_PART_KEYS.has(key)) {
        result[key] = Math.max(current, value); // the same story part scored again: its best score
      } else if (typeof current === 'number' && typeof value === 'number' && !NOT_ADDED.has(key)) {
        result[key] = current + value;
      } else if (typeof current === 'boolean' && typeof value === 'boolean') {
        result[key] = current || value;
      } else if (key === 'notes' && typeof current === 'string' && typeof value === 'string') {
        result.notes = joinText([current, value], '; ');
      } else if (value !== '' && value !== null && value !== undefined) {
        result[key] = value; // the latest single value (rating, target sound, food...)
      }
    }
  }
  if (Array.isArray(result.trials)) result.numberOfTrials = result.trials.length;
  // Work the summaries out again from the combined data.
  if (Array.isArray(result.intervals)) {
    result.intervalCount = result.intervals.length;
    return finalizeBehaviorData('BEHAVIOR_INTERVAL', result);
  }
  if (Array.isArray(result.latencies)) return finalizeBehaviorData('BEHAVIOR_LATENCY', result);
  return result;
}

/** The merged session (keeping the earliest one's id), from sessions that passed mergeProblem. */
export function mergeSessions(sessions: SessionData[]): SessionData {
  const ordered = [...sessions].sort(compareSessionsOldestFirst);
  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const starts = ordered.map(s => toMinutes(s.time)).filter((m): m is number => m !== null);
  const ends = ordered.map(s => toMinutes(s.endTime) ?? toMinutes(s.time)).filter((m): m is number => m !== null);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const goalIds = [...new Set(ordered.flatMap(s => (s.goals ?? []).map(g => g.goalId)))];
  const goals: SessionGoalData[] = goalIds.map(goalId => {
    const entries = ordered.map(s => s.goals?.find(g => g.goalId === goalId)).filter((g): g is SessionGoalData => !!g);
    const last = entries[entries.length - 1];
    return { ...last, data: mergeGoalData(entries.map(e => e.data)) };
  });

  const time = starts.length ? fmt(Math.min(...starts)) : first.time;
  const endTime = ends.length ? fmt(Math.max(...ends)) : first.endTime;
  // Behavior observation time adds up across the parts, but can't be longer than the merged session.
  const span = sessionMinutes({ time, endTime });
  if (span > 0) goals.forEach(g => {
    if (typeof g.data.observationMinutes === 'number') g.data.observationMinutes = Math.min(g.data.observationMinutes, span);
  });

  return {
    ...first,
    time,
    endTime,
    activity: joinText(ordered.map(s => s.activity), '; '),
    notes: joinText(ordered.map(s => s.notes), '\n'),
    goals,
    originalGoalHeaders: latest.originalGoalHeaders,
  };
}

/** Minutes before and after merging (the sum of each record's minutes, and the merged span). */
export function mergedMinutes(sessions: SessionData[]): { before: number; after: number } {
  return { before: sessions.reduce((sum, s) => sum + sessionMinutes(s), 0), after: sessionMinutes(mergeSessions(sessions)) };
}
