import type { SessionData, SessionGoalData } from './types';
import { compareSessionsOldestFirst, parseDateOnly } from './helpers';
import { sessionMinutes } from './student-overview';
import { finalizeBehaviorData } from './goal-constants/behavior';
import { STORY_PARTS } from './goal-constants/story-elements';

// Sessions → Merge: records of one student's session that were saved in parts (saved, then more data collected
// and saved again) become one session. Its time runs from the earliest start to the latest end, so service
// minutes count the time once instead of once per save, and the goal data is combined:
// - counts add up (correct/incorrect, prompts, behavior counts, observation minutes, fluency counts...);
// - lists are joined (trials, ABC incidents, duration episodes, occurrence times, intervals);
// - task analysis steps keep each step's latest score; ratings, settings (interval length, interval method)
//   and other single values keep the latest; story element scores keep the best score given;
// - summaries worked out from the data (% of intervals, average latency) are worked out again;
// - notes and activities are joined.
// Only sessions of the same student on the same day that took place (not missed) can be merged.

/** Why these sessions can't be merged, or null when they can. */
export function mergeProblem(sessions: SessionData[]): string | null {
  if (sessions.length < 2) return 'Select at least two sessions.';
  if (sessions.some(s => s.missed)) return 'Missed sessions can\'t be merged.';
  if (new Set(sessions.map(s => s.studentId)).size > 1) return 'Select sessions of one student.';
  if (new Set(sessions.map(s => parseDateOnly(s.date).toDateString())).size > 1) return 'Select sessions on the same day.';
  return null;
}

const joinText = (values: (string | undefined)[], separator: string) =>
  [...new Set(values.map(v => (v ?? '').trim()).filter(Boolean))].join(separator);

const toMinutes = (t?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '');
  if (!m) return null;
  const hours = Number(m[1]), minutes = Number(m[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

/** Appending a list without counting the same entry twice: records (objects, e.g. ABC incidents) dedup by
 * content, so the same incident saved in two parts counts once; plain values (trials, intervals, latencies,
 * duration episodes) dedup only when the whole list is the same one saved again, since two parts genuinely
 * hold different intervals or trials with the same values. */
const appendList = (current: unknown[], value: unknown[]): unknown[] => {
  if (value.some(v => v !== null && typeof v === 'object')) {
    const seen = new Set(current.map(v => JSON.stringify(v)));
    return [...current, ...value.filter(v => { const k = JSON.stringify(v); if (seen.has(k)) return false; seen.add(k); return true; })];
  }
  return JSON.stringify(value) === JSON.stringify(current) ? current : [...current, ...value];
};

// Numbers that are settings, times or summaries rather than counts: they keep the latest value (summaries are
// worked out again afterwards).
const NOT_ADDED = new Set(['rating', 'gasLevel', 'numberOfTrials', 'runningSince', 'intervalSeconds', 'percentIntervals', 'averageSeconds', 'timerStartedAt', 'cueGivenAt']);
const STORY_PART_KEYS = new Set<string>(STORY_PARTS.map(p => p.key));

/** Combines one goal's data from several sessions, oldest first. */
export function mergeGoalData(parts: Record<string, any>[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part ?? {})) {
      // Absent, not cleared: a part that never recorded a field (e.g. an untouched GAS goal whose
      // gasLevel is undefined) must not wipe the level an earlier part recorded.
      if (value === undefined) continue;
      const current = result[key];
      if (current === undefined) { result[key] = Array.isArray(value) ? [...value] : value; continue; }
      if (key === 'steps' && Array.isArray(current) && Array.isArray(value)) {
        // Task analysis: each step's latest score (by position), keeping earlier scores for steps scored once.
        // A later part that cleared a step (empty level) overwrites the earlier score instead of resurrecting it.
        const length = Math.max(current.length, value.length);
        result.steps = Array.from({ length }, (_, i) => (i < value.length && value[i] !== undefined ? value[i] : current[i] ?? value[i]));
      } else if (key === 'trials' && Array.isArray(current) && Array.isArray(value)) {
        // Trial grids: every scored trial (unscored ones don't count toward anything). The same grid saved
        // in two parts counts once.
        const grids = JSON.stringify(value) === JSON.stringify(current) ? current : [...current, ...value];
        const scored = grids.filter(t => t !== 'untouched');
        result.trials = scored.length ? scored : [...value];
      } else if (Array.isArray(current) && Array.isArray(value)) {
        result[key] = appendList(current, value);
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
      } else {
        // The latest single value (rating, target sound, food...), even a cleared one: an empty level or
        // empty text in a later part overwrites the earlier value instead of resurrecting it.
        result[key] = value;
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
  // Only an end time counts as an end: a part with no end time must not contribute its start as its end.
  const ends = ordered.map(s => toMinutes(s.endTime)).filter((m): m is number => m !== null);
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const goalIds = [...new Set(ordered.flatMap(s => (s.goals ?? []).map(g => g.goalId)))];
  const goals: SessionGoalData[] = goalIds.map(goalId => {
    const entries = ordered.map(s => s.goals?.find(g => g.goalId === goalId)).filter((g): g is SessionGoalData => !!g);
    const last = entries[entries.length - 1];
    return { ...last, data: mergeGoalData(entries.map(e => e.data)) };
  });

  const time = starts.length ? fmt(Math.min(...starts)) : first.time;
  const endTime = ends.length ? fmt(Math.max(...ends)) : first.endTime;
  // Behavior observation time adds up across the parts, but can't be longer than the merged session. The cap
  // uses the merged span itself (not sessionMinutes, which returns null past 600 minutes), so a long merged
  // session still caps it.
  const span = starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : null;
  if (span !== null && span > 0) goals.forEach(g => {
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
  return { before: sessions.reduce((sum, s) => sum + (sessionMinutes(s) ?? 0), 0), after: sessionMinutes(mergeSessions(sessions)) ?? 0 };
}
