import type { CustomGoalType, CustomMeasureKind, TargetDirection } from '../types';
import { finalizeBehaviorData, summarizeDuration } from '../goal-constants/behavior';
import { PROMPT_TYPES } from '../promptConstants';
import type { GoalTypeDefinition, MeasuredGoal } from './definition';

export const CUSTOM_TYPE_COLORS = [
  '#b7791f',
  '#2f855a',
  '#2b6cb0',
  '#9b2c2c',
  '#6b46c1',
  '#b83280',
] as const;

export const CUSTOM_MEASURE_KIND_INFO: Record<CustomMeasureKind, { label: string; shortLabel: string; description: string; defaultTarget: number }> = {
  accuracy: {
    label: 'Correct / incorrect',
    shortLabel: 'Accuracy',
    description: 'Tally correct, incorrect (and optionally approximate) responses. Measured as % correct.',
    defaultTarget: 80,
  },
  counter: {
    label: 'Counter',
    shortLabel: 'Counter',
    description: 'Count how many times something happens in the session (optionally reported per minute).',
    defaultTarget: 5,
  },
  timer: {
    label: 'Timer',
    shortLabel: 'Timer',
    description: 'Start and stop a timer for episodes or engaged time. Measured as total minutes.',
    defaultTarget: 10,
  },
  rating: {
    label: 'Rating scale',
    shortLabel: 'Rating scale',
    description: 'Pick a level on your own numeric scale with optional labels for each level.',
    defaultTarget: 4,
  },
  checklist: {
    label: 'Checklist',
    shortLabel: 'Checklist',
    description: 'Check off each step completed in the session. Measured as % of steps completed.',
    defaultTarget: 80,
  },
  yesno: {
    label: 'Yes / no',
    shortLabel: 'Yes / no',
    description: 'Answer a yes/no question each session. Measured as % of sessions met.',
    defaultTarget: 80,
  },
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));
const nonNeg = (v: unknown) => {
  const num = Number(v);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
};

function clearRunningTimers(data: Record<string, any>): Record<string, any> {
  return data.runningSince || data.cueGivenAt || data.timerStartedAt
    ? { ...data, runningSince: null, cueGivenAt: null, timerStartedAt: null }
    : data;
}

function promptCountOf(data: Record<string, any>): number {
  return PROMPT_TYPES.reduce((sum, p) => sum + Math.max(0, Number(data[p]) || 0), 0);
}

/** A deep copy of a CustomGoalType so edits to the library never mutate goals already assigned. */
export function cloneCustomGoalType(ct: CustomGoalType): CustomGoalType {
  return JSON.parse(JSON.stringify(ct));
}

/** Starting field values for the Custom Goal Type builder dialog. */
export function defaultCustomGoalType(id = ''): CustomGoalType {
  const now = new Date().toISOString();
  return {
    id,
    version: 1,
    name: '',
    description: '',
    color: CUSTOM_TYPE_COLORS[0],
    kind: 'accuracy',
    accuracy: { correctLabel: 'Correct', incorrectLabel: 'Incorrect', approximate: true },
    counter: { label: 'Occurrences', perMinute: false },
    timer: { label: 'Duration' },
    rating: { min: 1, max: 5, levelLabels: ['Emerging', 'Developing', 'Approaching', 'Consistent', 'Mastered'] },
    checklist: { steps: ['Step 1', 'Step 2', 'Step 3'] },
    yesno: { question: 'Met the criterion this session?' },
    defaultTarget: 80,
    direction: 'increase',
    extras: { promptLevel: false, notes: true },
    createdAt: now,
  };
}

/** A short summary of how a custom goal type is measured, e.g. "1–4 scale", "4 steps", "Counter". */
export function customTypeSummary(ct: CustomGoalType): string {
  switch (ct.kind) {
    case 'accuracy':
      return `${ct.accuracy?.correctLabel || 'Correct'} / ${ct.accuracy?.incorrectLabel || 'Incorrect'}${ct.accuracy?.approximate ? ' / Approx.' : ''}`;
    case 'counter':
      return `${ct.counter?.label || 'Count'}${ct.counter?.perMinute ? ' per minute' : ''}`;
    case 'timer':
      return `${ct.timer?.label || 'Timer'} (min)`;
    case 'rating':
      return `${ct.rating?.min ?? 1}–${ct.rating?.max ?? 5} scale`;
    case 'checklist':
      return `${ct.checklist?.steps?.length ?? 0} ${(ct.checklist?.steps?.length ?? 0) === 1 ? 'step' : 'steps'}`;
    case 'yesno':
      return 'Yes / no';
  }
}

/** Builds a GoalTypeDefinition from a stored CustomGoalType. */
export function makeCustomDef(ct: CustomGoalType): GoalTypeDefinition {
  const promptFields = ct.extras?.promptLevel
    ? Object.fromEntries(PROMPT_TYPES.map(p => [p, 0]))
    : {};

  const responses = (data: Record<string, any> = {}) => {
    if (ct.kind !== 'accuracy') return null;
    return {
      correct: nonNeg(data.correct),
      incorrect: nonNeg(data.incorrect),
      approximate: ct.accuracy?.approximate ? nonNeg(data.approximate) : 0,
    };
  };

  return {
    key: `CUSTOM:${ct.id}`,
    label: ct.name || 'Custom Goal',
    description: ct.description,
    defaultDirection: ct.direction || 'increase',
    usesPromptCounters: !!ct.extras?.promptLevel,
    isPercent: () => ct.kind === 'accuracy' || ct.kind === 'checklist' || ct.kind === 'yesno',

    initialData: () => {
      const notes = ct.extras?.notes !== false ? { notes: '' } : {};
      switch (ct.kind) {
        case 'accuracy':
          return {
            correct: 0,
            incorrect: 0,
            ...(ct.accuracy?.approximate ? { approximate: 0 } : {}),
            ...notes,
            ...promptFields,
          };
        case 'counter':
          return {
            count: 0,
            occurrenceTimes: [],
            ...(ct.counter?.perMinute ? { observationMinutes: '' } : {}),
            ...notes,
            ...promptFields,
          };
        case 'timer':
          return {
            episodeSeconds: [],
            episodeStarts: [],
            runningSince: null,
            totalSeconds: 0,
            episodeCount: 0,
            ...notes,
            ...promptFields,
          };
        case 'rating':
          return {
            rating: undefined,
            ...notes,
            ...promptFields,
          };
        case 'checklist': {
          const steps = ct.checklist?.steps?.length ? ct.checklist.steps : ['Step 1'];
          return {
            steps: steps.map(() => false),
            ...notes,
            ...promptFields,
          };
        }
        case 'yesno':
          return {
            met: null,
            ...notes,
            ...promptFields,
          };
      }
    },

    finalizeData: (data: Record<string, any>, now = Date.now()) => {
      if (ct.kind === 'timer') {
        return finalizeBehaviorData('BEHAVIOR_DURATION', data, now);
      }
      return data;
    },

    responses,

    accuracyText: (data: Record<string, any> = {}) => {
      switch (ct.kind) {
        case 'accuracy': {
          const r = responses(data)!;
          const total = r.correct + r.incorrect + r.approximate;
          return total === 0 ? 'N/A (0%)' : `${((r.correct / total) * 100).toFixed(1)}% (${r.correct}/${total})`;
        }
        case 'counter': {
          const count = nonNeg(data.count);
          if (ct.counter?.perMinute) {
            const mins = Number(data.observationMinutes);
            if (Number.isFinite(mins) && mins > 0) {
              return `${(count / mins).toFixed(2)}/min (${count} in ${mins} min)`;
            }
          }
          return `${count} ${(ct.counter?.label || 'occurrences').toLowerCase()}`;
        }
        case 'timer': {
          const summary = summarizeDuration(data);
          return `${(summary.totalSeconds / 60).toFixed(1)} min (${summary.episodeCount} ${summary.episodeCount === 1 ? 'period' : 'periods'})`;
        }
        case 'rating': {
          const min = ct.rating?.min ?? 1;
          const max = ct.rating?.max ?? 5;
          if (data.rating === undefined || data.rating === null || data.rating === '') return 'N/A (no rating selected)';
          const r = Number(data.rating);
          const label = ct.rating?.levelLabels?.[r - min];
          return label ? `${r} out of ${max} (${label})` : `${r} out of ${max}`;
        }
        case 'checklist': {
          const stepLabels = ct.checklist?.steps?.length ? ct.checklist.steps : ['Step 1'];
          const steps: boolean[] = Array.isArray(data.steps) ? data.steps : [];
          const done = steps.slice(0, stepLabels.length).filter(Boolean).length;
          return `${((done / stepLabels.length) * 100).toFixed(1)}% (${done}/${stepLabels.length} steps)`;
        }
        case 'yesno':
          if (data.met === true) return 'Yes (100%)';
          if (data.met === false) return 'No (0%)';
          return 'N/A (not answered yet)';
      }
    },

    measureInfo: () => {
      switch (ct.kind) {
        case 'accuracy':
          return { label: 'Accuracy', unit: '%', max: 100 };
        case 'counter': {
          const lbl = ct.counter?.label || 'Count';
          return ct.counter?.perMinute
            ? { label: `${lbl} per minute`, unit: '/min' }
            : { label: lbl, unit: '' };
        }
        case 'timer':
          return { label: `${ct.timer?.label || 'Total time'} (minutes)`, unit: ' min' };
        case 'rating': {
          const min = ct.rating?.min ?? 1;
          const max = ct.rating?.max ?? 5;
          return { label: `Rating (${min}-${max})`, unit: '', min, max };
        }
        case 'checklist':
          return { label: '% of steps completed', unit: '%', max: 100 };
        case 'yesno':
          return { label: '% of sessions met', unit: '%', max: 100 };
      }
    },

    measure: (_goal: MeasuredGoal, data: Record<string, any> = {}) => {
      switch (ct.kind) {
        case 'accuracy': {
          const r = responses(data)!;
          const total = r.correct + r.incorrect + r.approximate;
          return total > 0 ? (r.correct / total) * 100 : null;
        }
        case 'counter': {
          const count = nonNeg(data.count);
          const touched = data.recorded === true || count > 0 || String(data.notes || '').trim() !== '' || promptCountOf(data) > 0;
          if (!touched) return null;
          if (ct.counter?.perMinute) {
            const mins = Number(data.observationMinutes);
            return Number.isFinite(mins) && mins > 0 ? count / mins : count;
          }
          return count;
        }
        case 'timer': {
          const cleaned = clearRunningTimers(data);
          const fromEpisodes = Array.isArray(cleaned.episodeSeconds) && cleaned.episodeSeconds.length > 0
            ? summarizeDuration(cleaned).totalSeconds
            : 0;
          const totalSeconds = fromEpisodes > 0
            ? fromEpisodes
            : nonNeg(cleaned.totalSeconds ?? cleaned.seconds);
          const minutes = totalSeconds / 60;
          return data.recorded === true || minutes > 0 ? minutes : null;
        }
        case 'rating': {
          if (data.rating === undefined || data.rating === null || data.rating === '') return null;
          const r = Number(data.rating);
          if (!Number.isFinite(r)) return null;
          const min = ct.rating?.min ?? 1;
          const max = ct.rating?.max ?? 5;
          return Math.min(max, Math.max(min, r));
        }
        case 'checklist': {
          const stepLabels = ct.checklist?.steps?.length ? ct.checklist.steps : ['Step 1'];
          const total = stepLabels.length;
          if (total === 0) return null;
          const steps: boolean[] = Array.isArray(data.steps) ? data.steps : [];
          const checked = steps.slice(0, total).filter(Boolean).length;
          const touched = data.recorded === true || checked > 0 || String(data.notes || '').trim() !== '' || promptCountOf(data) > 0;
          return touched ? (checked / total) * 100 : null;
        }
        case 'yesno': {
          if (typeof data.met !== 'boolean') return null;
          return data.met ? 100 : 0;
        }
      }
    },

    formulaText: () => {
      switch (ct.kind) {
        case 'accuracy': {
          const c = ct.accuracy?.correctLabel || 'Correct';
          return `${c} responses ÷ all responses × 100.`;
        }
        case 'counter': {
          const lbl = (ct.counter?.label || 'items').toLowerCase();
          return ct.counter?.perMinute
            ? `The number of ${lbl} counted in the session ÷ observation minutes.`
            : `The number of ${lbl} counted in the session.`;
        }
        case 'timer':
          return `All the timed periods for “${ct.timer?.label || 'Timer'}” in the session added up, in minutes.`;
        case 'rating': {
          const min = ct.rating?.min ?? 1;
          const max = ct.rating?.max ?? 5;
          return `The ${min}–${max} rating given in the session.`;
        }
        case 'checklist': {
          const n = ct.checklist?.steps?.length || 1;
          return `Steps checked ÷ ${n} ${n === 1 ? 'step' : 'steps'} × 100.`;
        }
        case 'yesno':
          return '100% when answered “Yes” in the session, 0% when answered “No” (averages to the percentage of sessions met).';
      }
    },

    narrativeNoun: () => {
      switch (ct.kind) {
        case 'accuracy':
          return 'accuracy';
        case 'counter': {
          const lbl = (ct.counter?.label || 'occurrences').toLowerCase();
          return ct.counter?.perMinute ? `the rate of ${lbl} per minute` : `the number of ${lbl}`;
        }
        case 'timer':
          return 'the total time';
        case 'rating':
          return 'the rating';
        case 'checklist':
          return 'the percentage of steps completed';
        case 'yesno':
          return 'the percentage of sessions met';
      }
    },

    formatValue: (_goal: MeasuredGoal, value: number) => {
      const v = round(value);
      switch (ct.kind) {
        case 'accuracy':
        case 'checklist':
        case 'yesno':
          return `${v}%`;
        case 'counter':
          return ct.counter?.perMinute ? `${v}/min` : String(v);
        case 'timer':
          return `${v} min`;
        case 'rating':
          return `${v} out of ${ct.rating?.max ?? 5}`;
      }
    },

    formatTarget: (goal: MeasuredGoal, target: number, direction?: TargetDirection) => {
      const dir = direction ?? goal.targetDirection ?? ct.direction ?? 'increase';
      const sign = dir === 'decrease' ? '≤' : '≥';
      switch (ct.kind) {
        case 'accuracy':
        case 'checklist':
        case 'yesno':
          return dir === 'decrease' ? `≤ ${target}%` : `${target}%`;
        case 'counter':
          return ct.counter?.perMinute ? `${sign} ${target}/min` : `${sign} ${target} per session`;
        case 'timer':
          return `${sign} ${target} min`;
        case 'rating':
          return dir === 'decrease' ? `≤ ${target} out of ${ct.rating?.max ?? 5}` : `${target} out of ${ct.rating?.max ?? 5}`;
      }
    },
  };
}
