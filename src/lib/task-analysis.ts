import type { Goal, PromptType } from './types';
import { PROMPT_TYPES } from './promptConstants';

// Task analysis goals: a multi-step skill (a routine, a self-care task) broken into steps that are set on the
// student's goal (Edit Goal → Task Steps). In a session each step is scored with the support it needed, from
// Independent through the prompt levels, or Not done. The measure is the percentage of scored steps done
// independently. Each session keeps the steps' names, so changing the steps later doesn't change past data.

export type StepLevel = PromptType | 'NotDone';
export const STEP_LEVELS: StepLevel[] = [...PROMPT_TYPES, 'NotDone'];

export const STEP_LEVEL_LABELS: Record<StepLevel, string> = {
  Independent: 'Independent', Visual: 'Visual', Verbal: 'Verbal', Gestural: 'Gestural',
  PartialPhysical: 'Partial physical', Imitation: 'Model / imitation', NotDone: 'Not done',
};
export const STEP_LEVEL_SHORT: Record<StepLevel, string> = {
  Independent: 'I', Visual: 'Vis', Verbal: 'V', Gestural: 'G', PartialPhysical: 'PP', Imitation: 'M', NotDone: '—',
};

export interface TaskStepScore { label: string; level: StepLevel | '' }

/** The goal's steps (Edit Goal), trimmed, without blank lines. */
export function taskSteps(goal: Pick<Goal, 'taskSteps'>): string[] {
  return Array.isArray(goal.taskSteps) ? goal.taskSteps.map(s => String(s).trim()).filter(Boolean) : [];
}

/** A session's step scores, lined up with the goal's current steps (scores kept by position). */
export function stepScores(data: Record<string, any> = {}, steps: string[]): TaskStepScore[] {
  const saved: TaskStepScore[] = Array.isArray(data.steps) ? data.steps : [];
  if (steps.length === 0) return saved;
  return steps.map((label, i) => ({ label, level: saved[i]?.level ?? '' }));
}

/** Scored steps and how many were independent (from what a session saved). */
export function taskAnalysisSummary(data: Record<string, any> = {}) {
  const scored = (Array.isArray(data.steps) ? data.steps as TaskStepScore[] : []).filter(s => s && s.level);
  const independent = scored.filter(s => s.level === 'Independent').length;
  return { scored: scored.length, independent, percent: scored.length ? (independent / scored.length) * 100 : null };
}

/** Sets one step's level (the same level again clears it). */
export function setStepLevel(data: Record<string, any>, steps: string[], index: number, level: StepLevel): Record<string, any> {
  const scores = stepScores(data, steps);
  if (!scores[index]) return data;
  scores[index] = { ...scores[index], level: scores[index].level === level ? '' : level };
  return { ...data, steps: scores };
}

/** Scores the next unscored step (Data Entry hotkeys); null when every step is scored or there are none. */
export function scoreNextStep(data: Record<string, any>, steps: string[], level: StepLevel): Record<string, any> | null {
  const scores = stepScores(data, steps);
  const next = scores.findIndex(s => !s.level);
  if (next === -1) return null;
  scores[next] = { ...scores[next], level };
  return { ...data, steps: scores };
}
