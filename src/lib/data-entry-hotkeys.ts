import type { GoalType, TrialStatus } from './types';
import { PROMPT_HOTKEY_MAP } from './promptConstants';
import { GOAL_TYPES_WITHOUT_PROMPT_COUNTERS, alignTimes } from './goal-constants';

// Data Entry hotkeys that record data for the focused goal (see Help → Hotkeys):
//   C = correct, N = incorrect, B = approximate (Blocks for fluency); R/H/J = fluency repetitions,
//   prolongations, interjections; D/V/G/P/F/I = prompt levels (I also counts a correct response).
// Discrete and sequenced trials: C/N/B fill the next unscored trial. Behavior frequency: C adds an occurrence.

/**
 * The key a hotkey event stands for, as an upper-case letter or digit ("A", "1") or "ENTER". Uses the
 * physical key, because on Apple keyboards (including iPad keyboards) Option+letter types a symbol
 * (Option+A is "å"), which would never match the letter.
 */
export function hotkeyChar(event: Pick<KeyboardEvent, 'code' | 'key'>): string {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^(Digit|Numpad)[0-9]$/.test(code)) return code.slice(-1);
  if (code === 'Enter' || code === 'NumpadEnter') return 'ENTER';
  return (event.key || '').toUpperCase();
}

/** Whether keyboard input should go to a text field or an open dialog instead of the hotkeys. */
export function hotkeysBlocked(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  const typing = !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
  const dialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
  return typing || dialogOpen;
}

// Correct / incorrect count fields for each count-based goal type.
const COUNT_FIELDS: Partial<Record<GoalType, { correct: string; incorrect: string; approximate?: string }>> = {
  ARTICULATION: { correct: 'correct', incorrect: 'incorrect', approximate: 'approximate' },
  AAC: { correct: 'correct', incorrect: 'incorrect', approximate: 'approximate' },
  LANGUAGE_COMPREHENSION: { correct: 'questionsCorrect', incorrect: 'questionsIncorrect', approximate: 'approximate' },
  LANGUAGE_EXPRESSION: { correct: 'successfulResponses', incorrect: 'unsuccessfulResponses', approximate: 'approximate' },
  PHONOLOGICAL_PROCESSES: { correct: 'correctProductions', incorrect: 'incorrectProductions', approximate: 'approximate' },
  FEEDING_SWALLOWING: { correct: 'trialsAccepted', incorrect: 'trialsRefused' },
};

const FLUENCY_KEYS: Record<string, string> = { B: 'blocks', R: 'repetitions', H: 'prolongations', J: 'interjections' };

// Goal types entered on the trial grid.
const TRIAL_GRID_TYPES: GoalType[] = ['DISCRETE_TRIALS', 'SEQUENCED_TRIALS'];

const add = (data: Record<string, any>, field: string, amount = 1) => ({ ...data, [field]: (Number(data[field]) || 0) + amount });

function fillNextTrial(data: Record<string, any>, status: TrialStatus): Record<string, any> | null {
  const trials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : Array(Number(data.numberOfTrials) || 5).fill('untouched');
  const next = trials.indexOf('untouched');
  if (next === -1) return null;
  trials[next] = status;
  return { ...data, trials };
}

/** Records a "correct" response for the goal type (C, and I for independent). */
function addCorrect(type: GoalType, data: Record<string, any>): Record<string, any> | null {
  if (TRIAL_GRID_TYPES.includes(type)) return fillNextTrial(data, 'correct');
  if (type === 'BEHAVIOR_FREQUENCY') {
    const count = Number(data.count) || 0;
    return { ...data, count: count + 1, occurrenceTimes: [...alignTimes(data.occurrenceTimes, count), new Date().toISOString()] };
  }
  const fields = COUNT_FIELDS[type];
  return fields ? add(data, fields.correct) : null;
}

/** Takes back one correct response (the one Independent added): the last correct trial, or one from the count. */
export function removeCorrect(type: GoalType, data: Record<string, any>): Record<string, any> {
  if (TRIAL_GRID_TYPES.includes(type)) {
    const trials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : [];
    const last = trials.lastIndexOf('correct');
    if (last === -1) return data;
    trials[last] = 'untouched';
    return { ...data, trials };
  }
  const field = COUNT_FIELDS[type]?.correct;
  return field && Number(data[field]) > 0 ? { ...data, [field]: Number(data[field]) - 1 } : data;
}

/**
 * The goal's data after a hotkey, or null when the key does nothing for this goal type.
 * `type` is the type the goal's data is entered as (its data capture type).
 */
export function applyGoalHotkey(type: GoalType, key: string, data: Record<string, any>): Record<string, any> | null {
  if (key === 'C') return addCorrect(type, data);

  if (key === 'N') {
    if (TRIAL_GRID_TYPES.includes(type)) return fillNextTrial(data, 'incorrect');
    const fields = COUNT_FIELDS[type];
    return fields ? add(data, fields.incorrect) : null;
  }

  if (type === 'FLUENCY_SYLLABLE_STUTTER' && FLUENCY_KEYS[key]) {
    // Same as the fluency buttons: blocks, repetitions and interjections also add to the total syllables.
    const field = FLUENCY_KEYS[key];
    const next = add(data, field);
    return field === 'prolongations' ? next : add(next, 'totalSyllables');
  }

  if (key === 'B') {
    if (TRIAL_GRID_TYPES.includes(type)) return fillNextTrial(data, 'approximate');
    const approximate = COUNT_FIELDS[type]?.approximate;
    return approximate ? add(data, approximate) : null;
  }

  const promptType = PROMPT_HOTKEY_MAP[key as keyof typeof PROMPT_HOTKEY_MAP];
  if (promptType && !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes(type)) {
    const withPrompt = add(data, promptType);
    // An independent response is also a correct one. On the trial grid it needs a trial to fill: with every trial
    // scored it does nothing, so each Independent tally stands for a correct trial that removing it can take back.
    if (promptType !== 'Independent') return withPrompt;
    const withCorrect = addCorrect(type, withPrompt);
    if (!withCorrect && TRIAL_GRID_TYPES.includes(type)) return null;
    return withCorrect ?? withPrompt;
  }
  return null;
}
