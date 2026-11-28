import { BUILT_IN_GOAL_TYPE_VALUES, type BuiltInGoalType, type CustomGoalType, type GoalType, type TargetDirection, type TrialStatus } from '../types';
import {
  BEHAVIOR_GOAL_TYPES, activeCommFunctions, GOAL_TYPE_FIELDS, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS,
  behaviorMeasure, captureTypeOf, finalizeBehaviorData, goalDirection, scoreStory, summarizeCommunicationFunctions, toolTypeOf,
} from '../goal-constants';
import { gasLevelLabel } from '../gas';
import { PROMPT_TYPES } from '../promptConstants';
import { taskAnalysisSummary } from '../task-analysis';
import { formatSampleLength, languageSampleSummary, sampleUnit } from '../language-sample';
import { itemMasterySummary } from '../item-mastery';
import type { GoalMeasureInfo } from '../goal-measures';
import { isCustomGoal, type GoalTypeDefinition, type MeasuredGoal } from './definition';
import { defaultCustomGoalType, makeCustomDef } from './custom';

const round = (n: number, digits = 1) => Number(n.toFixed(digits));
const pluralWord = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const DEFAULT_RATING = 3;
const RATING_TYPES: string[] = ['QUALITATIVE_OBSERVATION', 'COGNITIVE'];
const NOT_PERCENT = new Set([
  'COMMUNICATION_FUNCTIONS', 'QUALITATIVE_OBSERVATION', 'COGNITIVE',
  'BEHAVIOR_FREQUENCY', 'BEHAVIOR_DURATION', 'BEHAVIOR_LATENCY',
  'GOAL_ATTAINMENT_SCALE', 'COMMUNICATION_COUNT', 'COMMUNICATION_DURATION', 'RESPONSE_TIME', 'LANGUAGE_SAMPLE',
]);

function builtInLabel(type: string): string {
  return type
    .split('_')
    .map(word => (word === 'AAC' || word === 'ABC' ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(' ');
}

function builtInResponses(type: string, data: Record<string, any> = {}): { correct: number; incorrect: number; approximate: number } | null {
  const n = (v: unknown) => { const num = Number(v); return Number.isFinite(num) ? Math.max(0, num) : 0; };
  const first = (...values: unknown[]) => {
    for (const v of values) if (v !== null && v !== undefined && v !== '') return v;
    return undefined;
  };
  switch (toolTypeOf(type)) {
    case 'ARTICULATION':
    case 'AAC':
    case 'LANGUAGE_COMPREHENSION':
    case 'LANGUAGE_EXPRESSION':
    case 'PHONOLOGICAL_PROCESSES':
      return {
        correct: n(first(data.correct, data.questionsCorrect, data.successfulResponses, data.correctProductions)),
        incorrect: n(first(data.incorrect, data.questionsIncorrect, data.unsuccessfulResponses, data.incorrectProductions)),
        approximate: n(data.approximate),
      };
    case 'FEEDING_SWALLOWING':
      return { correct: n(data.trialsAccepted), incorrect: n(data.trialsRefused), approximate: 0 };
    case 'SEQUENCED_TRIALS':
    case 'DISCRETE_TRIALS': {
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

function withoutRunningTimers(data: Record<string, any>): Record<string, any> {
  return data.runningSince || data.cueGivenAt || data.timerStartedAt
    ? { ...data, runningSince: null, cueGivenAt: null, timerStartedAt: null }
    : data;
}

function builtInMeasureInfo(type: BuiltInGoalType, goal: MeasuredGoal): GoalMeasureInfo {
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': return { label: '% fluent syllables', unit: '%', max: 100 };
    case 'STORY_ELEMENTS': return { label: 'Story score', unit: '%', max: 100 };
    case 'COMMUNICATION_FUNCTIONS': return { label: 'Functions used without a prompt', unit: '', max: Math.max(activeCommFunctions().length, 1) };
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return { label: 'Rating (1-5)', unit: '', max: 5 };
    case 'GOAL_ATTAINMENT_SCALE': return { label: 'Attainment level', unit: '', max: 2, min: -2 };
    case 'PROMPTING': return { label: '% independent', unit: '%', max: 100 };
    case 'TASK_ANALYSIS': return { label: '% of steps independent', unit: '%', max: 100 };
    case 'LANGUAGE_SAMPLE': return { label: `MLU (${sampleUnit(goal)})`, unit: '' };
    case 'ITEM_MASTERY': return { label: '% of items correct', unit: '%', max: 100 };
    case 'COMMUNICATION_COUNT': return { label: 'Times', unit: '' };
    case 'COMMUNICATION_DURATION': return { label: 'Total minutes', unit: ' min' };
    case 'RESPONSE_TIME': return { label: 'Average response time (seconds)', unit: ' s' };
    case 'COMMUNICATION_OPPORTUNITIES': return { label: '% of opportunities', unit: '%', max: 100 };
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

function builtInMeasure(rawType: BuiltInGoalType, goal: MeasuredGoal, data: Record<string, any> = {}): number | null {
  const type = toolTypeOf(rawType);
  if (BEHAVIOR_GOAL_TYPES.includes(type)) {
    const raw = behaviorMeasure(type, withoutRunningTimers(data), goalDirection(goal));
    if (raw === null) return null;
    const isPct = type === 'BEHAVIOR_INTERVAL' || (type === 'BEHAVIOR_ABC' && goalDirection(goal) === 'increase');
    const value = isPct ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
    return data.recorded === true || value !== 0 ? value : null;
  }

  const responses = builtInResponses(rawType, data);
  if (responses) {
    const total = responses.correct + responses.incorrect + responses.approximate;
    return total > 0 ? (responses.correct / total) * 100 : null;
  }
  const promptCount = PROMPT_TYPES.reduce((sum, p) => sum + Math.max(0, Number(data[p]) || 0), 0);
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': {
      const total = Math.max(0, Number(data.totalSyllables) || 0);
      const dysfluent = ['stutteredSyllables', 'blocks', 'repetitions', 'prolongations', 'interjections'].reduce(
        (sum, field) => sum + Math.max(0, Number(data[field]) || 0),
        0,
      );
      return total > 0 ? Math.min(100, (Math.max(0, total - dysfluent) / total) * 100) : null;
    }
    case 'STORY_ELEMENTS': {
      const story = scoreStory(data);
      if (story.maxPoints === 0) return null;
      if (story.points === 0) {
        const touched = data.recorded === true || story.notAssessed > 0 || story.linkingWords > 0 || String(data.notes || '').trim() !== '';
        if (!touched) return null;
      }
      return story.percent;
    }
    case 'COMMUNICATION_FUNCTIONS': {
      const summary = summarizeCommunicationFunctions(data);
      if (summary.total > 0) return Math.max(0, summary.functionsUsedUnprompted);
      return data.recorded === true ? 0 : null;
    }
    case 'PROMPTING': {
      const independent = Math.max(0, Number(data.Independent) || 0);
      return promptCount > 0 ? (independent / promptCount) * 100 : null;
    }
    case 'GOAL_ATTAINMENT_SCALE': {
      const level = data.gasLevel;
      return typeof level === 'number' && level >= -2 && level <= 2 ? level : null;
    }
    case 'TASK_ANALYSIS':
      return taskAnalysisSummary(data).percent;
    case 'LANGUAGE_SAMPLE':
      return languageSampleSummary(data).mlu;
    case 'ITEM_MASTERY':
      return itemMasterySummary(data).percent;
  }
  if (RATING_TYPES.includes(type)) {
    const rating = Number(data.rating);
    if (!rating) return null;
    const touched = data.recorded === true || rating !== DEFAULT_RATING || String(data.notes || '').trim() !== '' || promptCount > 0;
    return touched ? Math.min(5, Math.max(1, rating)) : null;
  }
  return null;
}

function builtInFormula(type: BuiltInGoalType, goal: MeasuredGoal): string {
  if (type === 'FEEDING_SWALLOWING') return 'Trials accepted ÷ (accepted + refused) × 100.';
  if (builtInResponses(type) !== null) return 'Correct ÷ (correct + approximate + incorrect) × 100. Approximate responses count as not correct.';
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': return '(Total syllables − stuttered syllables, blocks, repetitions, prolongations and interjections) ÷ total syllables × 100.';
    case 'STORY_ELEMENTS': return 'Points for the story parts assessed (0, 1 or 2 each) ÷ 2 × the number of parts assessed × 100. Parts marked N/A (not assessed) are left out.';
    case 'COMMUNICATION_FUNCTIONS': return 'The number of different functions used without a prompt in the session (spontaneous or emerging form).';
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return 'The 1–5 rating given in the session.';
    case 'GOAL_ATTAINMENT_SCALE': return 'The attainment level recorded in the session, -2 to +2; 0 is the expected outcome.';
    case 'PROMPTING': return 'Independent ÷ all prompt-level tallies × 100.';
    case 'TASK_ANALYSIS': return 'Steps done independently ÷ steps scored × 100.';
    case 'LANGUAGE_SAMPLE': return `Mean length of utterance: the ${sampleUnit(goal)} in all the utterances recorded in the session ÷ the number of utterances.`;
    case 'ITEM_MASTERY': return 'Items marked correct ÷ items tried in the session × 100. Items not tried are left out. An item counts as mastered once it is correct 3 sessions in a row.';
    case 'COMMUNICATION_COUNT': return 'The number of times counted in the session.';
    case 'COMMUNICATION_DURATION': return 'All the timed periods in the session added up, in minutes.';
    case 'RESPONSE_TIME': return 'The average seconds from the cue to the response, over the trials with a response.';
    case 'BEHAVIOR_FREQUENCY': return 'The number of times the behavior was counted in the session.';
    case 'BEHAVIOR_DURATION': return 'All the episodes\' times in the session added up, in minutes.';
    case 'BEHAVIOR_INTERVAL': return 'Intervals marked + (behavior seen) ÷ intervals scored × 100.';
    case 'BEHAVIOR_LATENCY': return 'The average seconds from the cue to the response, over the trials with a response.';
    case 'BEHAVIOR_ABC':
      return goalDirection(goal) === 'decrease'
        ? 'The number of incidents with problem behavior in the session.'
        : 'Incidents where the replacement skill was used ÷ all incidents × 100.';
    default: return 'The value recorded in the session.';
  }
}

function builtInNarrativeNoun(type: BuiltInGoalType, goal: MeasuredGoal): string {
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': return 'the percentage of fluent syllables';
    case 'STORY_ELEMENTS': return 'the story score';
    case 'COMMUNICATION_FUNCTIONS': return 'the number of functions used without a prompt';
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return 'the rating';
    case 'PROMPTING': return 'the percentage of independent responses';
    case 'TASK_ANALYSIS': return 'the percentage of steps done independently';
    case 'LANGUAGE_SAMPLE': return 'the mean length of utterance';
    case 'ITEM_MASTERY': return 'the percentage of items correct';
    case 'COMMUNICATION_COUNT': return 'the number of times';
    case 'COMMUNICATION_DURATION': return 'the total time';
    case 'RESPONSE_TIME': return 'the average time to respond';
    case 'COMMUNICATION_OPPORTUNITIES': return 'the percentage of opportunities';
    case 'BEHAVIOR_FREQUENCY': return 'the number of occurrences';
    case 'BEHAVIOR_DURATION': return 'the total duration';
    case 'BEHAVIOR_INTERVAL': return 'the percentage of intervals with the behavior';
    case 'BEHAVIOR_LATENCY': return 'the average time to respond';
    case 'BEHAVIOR_ABC': return goalDirection(goal) === 'decrease' ? 'the number of problem behavior incidents' : 'the percentage of incidents with the replacement skill';
    case 'GOAL_ATTAINMENT_SCALE': return 'the attainment level';
    default: return 'accuracy';
  }
}

function builtInFormatValue(type: BuiltInGoalType, goal: MeasuredGoal, value: number): string {
  const v = round(value);
  switch (type) {
    case 'GOAL_ATTAINMENT_SCALE': return gasLevelLabel(v);
    case 'LANGUAGE_SAMPLE': return formatSampleLength(value, sampleUnit(goal));
    case 'BEHAVIOR_FREQUENCY':
    case 'COMMUNICATION_COUNT':
    case 'COMMUNICATION_FUNCTIONS': return String(v);
    case 'BEHAVIOR_DURATION':
    case 'COMMUNICATION_DURATION': return `${v} min`;
    case 'BEHAVIOR_LATENCY':
    case 'RESPONSE_TIME': return `${v} ${v === 1 ? 'second' : 'seconds'}`;
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return `${v} out of 5`;
    case 'BEHAVIOR_ABC': return goalDirection(goal) === 'decrease' ? String(v) : `${v}%`;
    default: return `${v}%`;
  }
}

function builtInFormatTarget(type: string, target: number, direction?: TargetDirection, usesTarget?: number, goal?: MeasuredGoal): string {
  if (type === 'LANGUAGE_SAMPLE') return `MLU ≥ ${formatSampleLength(target, sampleUnit(goal))}`;
  if (type === 'ITEM_MASTERY') return `${target}% of items correct`;
  if (type === 'COMMUNICATION_COUNT' || type === 'COMMUNICATION_DURATION' || type === 'RESPONSE_TIME') {
    const sign = (direction ?? (type === 'RESPONSE_TIME' ? 'decrease' : 'increase')) === 'decrease' ? '≤' : '≥';
    if (type === 'COMMUNICATION_COUNT') return `${sign} ${target} per session`;
    if (type === 'COMMUNICATION_DURATION') return `${sign} ${target} min`;
    return `${sign} ${target} s average`;
  }
  if (type === 'COMMUNICATION_OPPORTUNITIES') return `${target}% of opportunities`;
  if (type.startsWith('BEHAVIOR_')) {
    const sign = (direction ?? 'decrease') === 'decrease' ? '≤' : '≥';
    if (type === 'BEHAVIOR_FREQUENCY') return `${sign} ${target} per session`;
    if (type === 'BEHAVIOR_DURATION') return `${sign} ${target} min`;
    if (type === 'BEHAVIOR_INTERVAL') return `${sign} ${target}% of intervals`;
    if (type === 'BEHAVIOR_LATENCY') return `${sign} ${target} s average`;
    return direction === 'increase' ? `≥ ${target}% replacement skill` : `≤ ${pluralWord(target, 'incident')}`;
  }
  if (type === 'COMMUNICATION_FUNCTIONS') {
    return usesTarget && usesTarget > 0
      ? `${pluralWord(target, 'function')} and at least ${pluralWord(usesTarget, 'use')}`
      : pluralWord(target, 'function');
  }
  if (type === 'GOAL_ATTAINMENT_SCALE') return target === 0 ? 'level 0 (expected outcome)' : `level ${target}`;
  if (type.startsWith('QUALITATIVE') || type === 'COGNITIVE') return `${target} out of 5`;
  return `${target}%`;
}

function makeBuiltInDef(type: BuiltInGoalType): GoalTypeDefinition {
  const defaultDirection: TargetDirection =
    type === 'RESPONSE_TIME' || BEHAVIOR_GOAL_TYPES.includes(type) ? 'decrease' : 'increase';
  return {
    key: type,
    label: builtInLabel(type),
    defaultDirection,
    usesPromptCounters: !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes(type),
    isPercent: (goal: MeasuredGoal) => {
      if (type === 'BEHAVIOR_ABC') return goal.targetDirection === 'increase';
      return !NOT_PERCENT.has(type);
    },
    initialData: () => JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[type] || {})),
    finalizeData: (data: Record<string, any>, now = Date.now()) => finalizeBehaviorData(type, data, now),
    responses: (data: Record<string, any> = {}) => builtInResponses(type, data),
    measureInfo: (goal: MeasuredGoal) => builtInMeasureInfo(type, goal),
    measure: (goal: MeasuredGoal, data: Record<string, any> = {}) => builtInMeasure(type, goal, data),
    formulaText: (goal: MeasuredGoal) => builtInFormula(type, goal),
    narrativeNoun: (goal: MeasuredGoal) => builtInNarrativeNoun(type, goal),
    formatValue: (goal: MeasuredGoal, value: number) => builtInFormatValue(type, goal, value),
    formatTarget: (goal: MeasuredGoal, target: number, direction?: TargetDirection, usesTarget?: number) =>
      builtInFormatTarget(type, target, direction, usesTarget, goal),
  };
}

/** One GoalTypeDefinition for every built-in goal type. */
export const BUILT_IN_DEFS: Record<BuiltInGoalType, GoalTypeDefinition> = Object.fromEntries(
  BUILT_IN_GOAL_TYPE_VALUES.map(type => [type, makeBuiltInDef(type)]),
) as Record<BuiltInGoalType, GoalTypeDefinition>;

/** Looks up a built-in goal type definition by its key (falls back to DISCRETE_TRIALS for unknown keys). */
export function getBuiltInGoalTypeDef(type: string): GoalTypeDefinition {
  return BUILT_IN_DEFS[type as BuiltInGoalType] ?? BUILT_IN_DEFS.DISCRETE_TRIALS;
}

/**
 * Looks up the GoalTypeDefinition for a goal or template (or a plain type key).
 * For CUSTOM goals, builds the definition from the goal's stored customType copy.
 */
export function getGoalTypeDef(
  goalOrType: MeasuredGoal | { type: GoalType | string; dataCaptureType?: GoalType | string; targetDirection?: TargetDirection; customType?: CustomGoalType } | string,
): GoalTypeDefinition {
  if (typeof goalOrType === 'string') {
    if (goalOrType === 'CUSTOM') return makeCustomDef(defaultCustomGoalType('fallback'));
    return getBuiltInGoalTypeDef(goalOrType);
  }
  if (isCustomGoal(goalOrType)) {
    return makeCustomDef(goalOrType.customType);
  }
  const capture = captureTypeOf(goalOrType as { type: string; dataCaptureType?: string });
  if (capture === 'CUSTOM') {
    return makeCustomDef(goalOrType.customType ?? defaultCustomGoalType('fallback'));
  }
  return getBuiltInGoalTypeDef(capture);
}
