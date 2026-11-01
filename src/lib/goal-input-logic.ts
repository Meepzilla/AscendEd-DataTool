import type { TrialStatus } from './types';
import { goalResponses } from './goal-measures';
import { scoreStory, summarizeCommunicationFunctions } from './goal-constants';

/** The most trials a trial grid can have (the Number of Trials input's maximum). */
export const MAX_TRIALS = 100;

// The calculations behind Data Entry's goal inputs (goal-data-input.tsx and goal-inputs/), as plain functions.

/** The data after changing one field, with the fields that follow it: fluency totals and the trial grid's size. */
export function applyFieldChange(captureType: string, data: Record<string, any>, field: string, value: unknown): Record<string, any> {
  const next: Record<string, any> = { ...data, [field]: value };
  // A dysfluent syllable is also a syllable, so changing a dysfluency count changes total syllables by the
  // same amount (up or down, so a mistaken tap taken back leaves the total as it was).
  if (captureType === 'FLUENCY_SYLLABLE_STUTTER' && ['stutteredSyllables', 'blocks', 'repetitions', 'interjections'].includes(field)) {
    const change = (Number(value) || 0) - (Number(data[field]) || 0);
    next.totalSyllables = Math.max(0, (Number(next.totalSyllables) || 0) + change);
  }
  // A cleared or partly typed count leaves the trials as they are until a number is entered.
  if (field === 'numberOfTrials' && Number(value) >= 1) {
    const size = Math.min(MAX_TRIALS, Math.floor(Number(value)));
    const old: TrialStatus[] = Array.isArray(data.trials) ? data.trials : [];
    next.trials = Array.from({ length: size }, (_, i) => old[i] ?? 'untouched');
  }
  return next;
}

/**
 * The result line shown under a goal's inputs: accuracy, % fluent, story score or functions used. Count types use
 * goalResponses (the same counting as Reports), so the card and the reports agree.
 */
export function goalAccuracyText(captureType: string, data: Record<string, any>): string {
  switch (captureType) {
    case 'FLUENCY_SYLLABLE_STUTTER': {
      const total = Number(data.totalSyllables || 0);
      const dysfluencies = Number(data.stutteredSyllables || 0) + Number(data.blocks || 0) + Number(data.repetitions || 0) + Number(data.interjections || 0);
      return total === 0 ? 'N/A (0%)' : `${((Math.max(0, total - dysfluencies) / total) * 100).toFixed(1)}% (${Math.max(0, total - dysfluencies)}/${total})`;
    }
    case 'COMMUNICATION_FUNCTIONS': {
      const summary = summarizeCommunicationFunctions(data);
      return `${summary.functionsUsedSpontaneously} of ${summary.functionCount} used spontaneously (${summary.spontaneous} spontaneous, ${summary.prompted} prompted)`;
    }
    case 'STORY_ELEMENTS': {
      const story = scoreStory(data);
      return `${story.percent.toFixed(1)}% (${story.points}/${story.maxPoints} points)`;
    }
  }
  const responses = goalResponses(captureType, data);
  if (!responses) return 'N/A';
  const total = responses.correct + responses.incorrect + responses.approximate;
  // The trial grid shows 0% before any trial is scored; counts show N/A.
  if (total === 0) return captureType === 'DISCRETE_TRIALS' ? '0.0% (0/0)' : 'N/A (0%)';
  return `${((responses.correct / total) * 100).toFixed(1)}% (${responses.correct}/${total})`;
}

// The trial grid (discrete and sequenced trials). Each returns the new trials, or null when nothing changes.

const currentTrials = (data: Record<string, any>): TrialStatus[] =>
  Array.isArray(data.trials) ? [...data.trials] : Array(data.numberOfTrials || 5).fill('untouched');

const NEXT_STATUS: Record<TrialStatus, TrialStatus> = { untouched: 'correct', correct: 'approximate', approximate: 'incorrect', incorrect: 'untouched' };

/** Tapping a trial cycles it: not scored → correct → approximate → incorrect → not scored. */
export function cycleTrial(data: Record<string, any>, index: number): TrialStatus[] {
  const trials = currentTrials(data);
  trials[index] = NEXT_STATUS[trials[index] || 'untouched'];
  return trials;
}

/** Scores the next unscored trial; null when every trial is scored. */
export function scoreNextTrial(data: Record<string, any>, status: TrialStatus): TrialStatus[] | null {
  const trials = currentTrials(data);
  const next = trials.indexOf('untouched');
  if (next === -1) return null;
  trials[next] = status;
  return trials;
}

/** Clears the last scored trial; null when none is scored. */
export function undoLastTrial(data: Record<string, any>): TrialStatus[] | null {
  const trials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : [];
  const last = trials.map((t, i) => (t !== 'untouched' ? i : -1)).filter(i => i !== -1).pop();
  if (last === undefined) return null;
  trials[last] = 'untouched';
  return trials;
}

/** Every trial back to not scored (the number of trials stays). */
export function clearTrials(data: Record<string, any>): TrialStatus[] {
  return Array((Array.isArray(data.trials) ? data.trials : []).length).fill('untouched');
}
