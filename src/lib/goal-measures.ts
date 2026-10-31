import { taskAnalysisSummary } from './task-analysis';
import type { Goal, GoalType, TrialStatus } from './types';
import {
  behaviorMeasure, captureTypeOf, goalDirection, scoreStory, summarizeCommunicationFunctions, BEHAVIOR_GOAL_TYPES,
  COMMUNICATION_FUNCTIONS, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS,
} from './goal-constants';
import { PROMPT_TYPES } from './promptConstants';

// The one number each goal is measured by in a session, so every goal type can be charted against its
// target: accuracy % for trial-based goals, story score %, number of functions used spontaneously,
// a 1-5 rating, % independent, and the behavior measures (count, minutes, %, seconds).

export interface GoalMeasureInfo {
  label: string;
  unit: string; // appended to values, e.g. '%', ' min'
  max?: number; // fixed top of the chart scale, when there is one
}

/** Correct, incorrect and approximate responses for the trial-based goal types; null for other types. */
export function goalResponses(type: string, data: Record<string, any> = {}): { correct: number; incorrect: number; approximate: number } | null {
  const n = (v: unknown) => Number(v) || 0;
  switch (type) {
    case 'ARTICULATION':
    case 'AAC':
    case 'LANGUAGE_COMPREHENSION':
    case 'LANGUAGE_EXPRESSION':
    case 'PHONOLOGICAL_PROCESSES':
      // These types name their counts differently; a goal can also be entered with another type's
      // inputs (its data capture type), so any of the names is accepted.
      return {
        correct: n(data.correct || data.questionsCorrect || data.successfulResponses || data.correctProductions),
        incorrect: n(data.incorrect || data.questionsIncorrect || data.unsuccessfulResponses || data.incorrectProductions),
        approximate: n(data.approximate),
      };
    case 'FEEDING_SWALLOWING':
      return { correct: n(data.trialsAccepted), incorrect: n(data.trialsRefused), approximate: 0 };
    case 'SEQUENCED_TRIALS':
    case 'DISCRETE_TRIALS': {
      // Sequenced trials are entered on the trial grid; counts are from sessions entered before that.
      const trials: TrialStatus[] = Array.isArray(data.trials) ? data.trials : [];
      const count = (status: TrialStatus) => trials.filter(t => t === status).length;
      const counted = type === 'SEQUENCED_TRIALS';
      return {
        correct: count('correct') + (counted ? n(data.successfulAttempts) : 0),
        incorrect: count('incorrect') + (counted ? n(data.failedAttempts) : 0),
        approximate: count('approximate') + (counted ? n(data.approximate) : 0),
      };
    }
    default:
      return null;
  }
}

export function promptTotals(data: Record<string, any> = {}): Record<string, number> {
  return Object.fromEntries(PROMPT_TYPES.map(p => [p, Number(data[p]) || 0]));
}

const RATING_TYPES: string[] = ['QUALITATIVE_OBSERVATION', 'COGNITIVE'];

/** The goal fields measuring needs; goals are measured by the type their data was entered as. */
type MeasuredGoal = Pick<Goal, 'type' | 'targetDirection' | 'dataCaptureType'>;
const DEFAULT_RATING = 3;

export function goalMeasureInfo(goal: MeasuredGoal): GoalMeasureInfo {
  switch (captureTypeOf(goal)) {
    case 'FLUENCY_SYLLABLE_STUTTER': return { label: '% fluent syllables', unit: '%', max: 100 };
    case 'STORY_CHAMPS': return { label: 'Story score', unit: '%', max: 100 };
    case 'COMMUNICATION_FUNCTIONS': return { label: 'Functions used spontaneously', unit: '', max: COMMUNICATION_FUNCTIONS.length };
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return { label: 'Rating (1-5)', unit: '', max: 5 };
    case 'PROMPTING': return { label: '% independent', unit: '%', max: 100 };
    case 'TASK_ANALYSIS': return { label: '% of steps independent', unit: '%', max: 100 };
    case 'BEHAVIOR_FREQUENCY': return { label: 'Occurrences', unit: '' };
    case 'BEHAVIOR_DURATION': return { label: 'Total minutes', unit: ' min' };
    case 'BEHAVIOR_INTERVAL': return { label: '% of intervals', unit: '%', max: 100 };
    case 'BEHAVIOR_LATENCY': return { label: 'Average latency (seconds)', unit: ' s' };
    case 'BEHAVIOR_ABC':
      return goalDirection(goal) === 'decrease'
        ? { label: 'Problem behavior incidents', unit: '' }
        : { label: '% of incidents with replacement skill', unit: '%', max: 100 };
    default: return { label: 'Accuracy', unit: '%', max: 100 };
  }
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
  const type = captureTypeOf(goal);
  if (BEHAVIOR_GOAL_TYPES.includes(type)) {
    // A behavior goal left untouched in a session reads as 0; it counts only if Data Entry marked it as
    // worked on (so an observed 0 is kept) or something was recorded.
    const value = behaviorMeasure(type, withoutRunningTimers(data), goalDirection(goal));
    return value !== null && (data.recorded === true || value !== 0) ? value : null;
  }

  const responses = goalResponses(type, data);
  if (responses) {
    const total = responses.correct + responses.incorrect + responses.approximate;
    return total > 0 ? (responses.correct / total) * 100 : null;
  }
  const prompts = promptTotals(data);
  const promptCount = Object.values(prompts).reduce((a, b) => a + b, 0);
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': {
      const total = Number(data.totalSyllables) || 0;
      // The same dysfluencies Data Entry counts (prolongations are tallied but not subtracted there either).
      const dysfluent = ['stutteredSyllables', 'blocks', 'repetitions', 'interjections'].reduce((sum, field) => sum + (Number(data[field]) || 0), 0);
      return total > 0 ? (Math.max(0, total - dysfluent) / total) * 100 : null;
    }
    case 'STORY_CHAMPS': {
      const story = scoreStory(data);
      return story.points > 0 || story.linkingWords > 0 ? story.percent : null;
    }
    case 'COMMUNICATION_FUNCTIONS': {
      const summary = summarizeCommunicationFunctions(data);
      return summary.spontaneous + summary.prompted > 0 ? summary.functionsUsedSpontaneously : null;
    }
    case 'PROMPTING':
      return promptCount > 0 ? (prompts.Independent / promptCount) * 100 : null;
    case 'TASK_ANALYSIS':
      return taskAnalysisSummary(data).percent;
  }
  if (RATING_TYPES.includes(type)) {
    // The rating starts at 3, so a session counts only if the goal was worked on (Data Entry marks it as
    // recorded; older sessions: the rating was changed or something else was entered).
    const rating = Number(data.rating);
    if (!rating) return null;
    const touched = data.recorded === true || rating !== DEFAULT_RATING || String(data.notes || '').trim() !== '' || promptCount > 0;
    return touched ? rating : null;
  }
  return null;
}

/**
 * Whether a session's measure meets the goal's target (at or below it for decrease goals). The measure is
 * compared as it is shown (to 0.1), so a value shown as "5" never reads as missing a target of 5.
 */
export function meetsTarget(goal: MeasuredGoal, value: number, target: number): boolean {
  const shown = Math.round(value * 10) / 10;
  return goalDirection(goal) === 'decrease' ? shown <= target : shown >= target;
}

export function usesPromptCounters(type: string): boolean {
  return !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes(type as GoalType);
}

/** A session's free-text notes for a goal, whichever field the goal type uses. */
export function goalNotes(data: Record<string, any> = {}): string {
  return [data.notes, data.details, data.observationNotes].map(v => String(v ?? '').trim()).filter(Boolean).join(' · ');
}
