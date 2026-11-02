import type { Goal, TargetDirection } from './types';
import { captureTypeOf, goalDirection } from './goal-constants';
import { goalMeasureInfo, goalResponses, meetsTarget } from './goal-measures';
import { AIM_RULE_SESSIONS, aimValueAt, type AimLine } from './aim-line';
import { formatDate, formatGoalTarget } from './helpers';

// How each figure on the Reports page is worked out, in words and with the numbers behind it, for the
// explanation shown when a figure is tapped or hovered.

const round = (n: number) => Math.round(n * 10) / 10;
/** At most this many session values are listed in a sum; more are given as their total. */
const LISTED_VALUES = 8;

/** How one session's measure is worked out for a goal's type. */
export function measureFormula(goal: Pick<Goal, 'type' | 'dataCaptureType' | 'targetDirection'>): string {
  const type = captureTypeOf(goal);
  if (type === 'FEEDING_SWALLOWING') return 'Trials accepted ÷ (accepted + refused) × 100.';
  if (goalResponses(type) !== null) return 'Correct ÷ (correct + approximate + incorrect) × 100. Approximate responses count as not correct.';
  switch (type) {
    case 'FLUENCY_SYLLABLE_STUTTER': return '(Total syllables − stuttered syllables, blocks, repetitions and interjections) ÷ total syllables × 100.';
    case 'STORY_ELEMENTS': return 'Points for the story parts assessed (0, 1 or 2 each) ÷ 2 × the number of parts assessed × 100. Parts marked N/A (not assessed) are left out.';
    case 'COMMUNICATION_FUNCTIONS': return 'The number of different functions used without a prompt in the session.';
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return 'The 1–5 rating given in the session.';
    case 'PROMPTING': return 'Independent ÷ all prompt-level tallies × 100.';
    case 'TASK_ANALYSIS': return 'Steps done independently ÷ steps scored × 100.';
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

/** One session's responses worked through: "8 correct ÷ 10 responses (8 + 1 + 1) × 100 = 80%". */
export function responsesWorking(r: { correct: number; incorrect: number; approximate: number }, feeding = false): string | null {
  const total = r.correct + r.incorrect + r.approximate;
  if (total === 0) return null;
  const percent = round((r.correct / total) * 100);
  return feeding
    ? `${r.correct} accepted ÷ ${total} trials (${r.correct} + ${r.incorrect} refused) × 100 = ${percent}%`
    : `${r.correct} correct ÷ ${total} responses (${r.correct} + ${r.approximate} approximate + ${r.incorrect} incorrect) × 100 = ${percent}%`;
}

/** "(80 + 70 + 90) ÷ 3 = 80%", or with many sessions "640 (8 sessions added up) ÷ 8 = 80%". */
export function averageWorking(values: number[], unit: string): string | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const average = round(sum / values.length);
  const added = values.length <= LISTED_VALUES ? `(${values.join(' + ')})` : `${round(sum)} (the ${values.length} sessions added up)`;
  return `${added} ÷ ${values.length} = ${average}${unit}`;
}

const comparison = (direction: TargetDirection) => (direction === 'decrease' ? 'at or below' : 'at or above');

export interface GoalStatExplanations {
  sessions: string;
  latest: string;
  average: string;
  metTarget: string;
  aimLine: string;
}

/** What each figure on a goal's card means and how it was worked out, from the goal's recorded sessions. */
export function goalStatExplanations(
  goal: Goal,
  recorded: { date: string; value: number; data: Record<string, any> }[],
  aim: AimLine | null,
  mastery: number,
): GoalStatExplanations {
  const info = goalMeasureInfo(goal);
  const type = captureTypeOf(goal);
  const direction = goalDirection(goal);
  const target = goal.sessionTargetValue;
  const values = recorded.map(r => r.value);
  const last = recorded[recorded.length - 1];
  const label = info.label.charAt(0).toLowerCase() + info.label.slice(1);
  const lastResponses = last ? goalResponses(type, last.data) : null;
  const working = lastResponses ? responsesWorking(lastResponses, type === 'FEEDING_SWALLOWING') : null;
  const average = averageWorking(values, info.unit);
  const met = target === undefined ? 0 : values.filter(v => meetsTarget(goal, v, target)).length;
  const targetText = target === undefined ? '' : formatGoalTarget(type, target, goal.targetDirection);

  let aimText = '';
  if (aim) {
    const startDate = formatDate(new Date(aim.start.time));
    const endDate = formatDate(new Date(aim.end.time));
    aimText = `The aim line runs from the baseline (${round(aim.start.value)}${info.unit} on ${startDate}) to the target `
      + `(${round(aim.end.value)}${info.unit} by ${endDate}): where the ${label} needs to be on each date to meet the goal on time. `
      + `Behind when the last ${AIM_RULE_SESSIONS} sessions are all ${direction === 'decrease' ? 'above' : 'below'} it; otherwise on track.`;
    if (last) {
      const expected = round(aimValueAt(aim, last.date));
      aimText += ` In the latest session the aim line was at ${expected}${info.unit} and the ${label} was ${last.value}${info.unit}.`;
    }
  }

  return {
    sessions: 'Sessions in the date range where something was recorded for this goal. Missed sessions, and sessions where the goal wasn\'t worked on, aren\'t counted.',
    latest: last
      ? `The ${label} in the most recent session (${formatDate(last.date)}). ${measureFormula(goal)}${working ? ` That session: ${working}.` : ''}`
      : `The ${label} in the most recent session. ${measureFormula(goal)}`,
    average: average
      ? `The average of each session's ${label}: ${average}. Each session counts the same, however many trials it had.`
      : `The average of each session's ${label}.`,
    metTarget: target === undefined ? '' : `Sessions where the ${label} was ${comparison(direction)} the target (${targetText}): ${met} of ${values.length}. `
      + `Mastery is the target met in ${mastery} session${mastery === 1 ? '' : 's'} in a row.`,
    aimLine: aimText,
  };
}

/** The Data Summary's figures, from the totals over every trial-based goal in the range. */
export function summaryExplanations(totals: { correct: number; incorrect: number; approximate: number; opportunities: number }, goalSelected: boolean) {
  const { correct, incorrect, approximate, opportunities } = totals;
  const trialGoals = 'Only goals scored as correct, approximate or incorrect are counted (accuracy, trials, AAC, language, articulation; feeding trials accepted count as correct and refused as incorrect).';
  return {
    sessions: goalSelected
      ? 'Sessions in the date range with something recorded for the selected goal. Missed sessions aren\'t counted.'
      : 'Sessions in the date range. Missed sessions aren\'t counted.',
    accuracy: opportunities > 0
      ? `Total correct ÷ total opportunities × 100 = ${correct} ÷ ${opportunities} × 100 = ${round((correct / opportunities) * 100)}%. `
        + 'Every response in the range is pooled, so a session with more trials counts for more. Each goal\'s Average below averages its sessions instead.'
      : `No responses scored as correct, approximate or incorrect in this range. ${trialGoals}`,
    opportunities: `Correct + approximate + incorrect = ${correct} + ${approximate} + ${incorrect} = ${opportunities}. ${trialGoals}`,
    correct: `Correct responses added up over every session in the range. ${trialGoals}`,
    incorrect: `Incorrect responses added up over every session in the range. ${trialGoals}`,
    approximate: 'Approximate responses (partly correct) added up over every session in the range. They count toward opportunities but not toward accuracy.',
  };
}
