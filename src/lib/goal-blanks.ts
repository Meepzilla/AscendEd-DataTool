import type { Goal } from './types';

// Blanks in goal text (goal bank wording such as "using ______ (AAC device) ... in ___ out of ___ opportunities
// as measured by ______"). A run of three or more underscores is a blank. Blanks are filled where the goal is
// shown (its text and name), the same way "[date]" and "STUDENT" are; the stored text keeps its blanks.
// - Blanks the goal's own settings can answer are filled automatically: "___%" with the target, "___ out of ___"
//   with the target as a fraction (80% → 4 out of 5) when the text states no percentage, and "___ consecutive"
//   with the mastery sessions. In "___% accuracy in ___ out of ___ opportunities" the fraction is a separate
//   criterion (how many opportunities), so it isn't taken from the target.
// - Any blank can be filled by hand in Edit Goal (goal.blankFills, by position); that wins over the automatic value.

const BLANK = /_{3,}/g;

export interface GoalBlank {
  /** Position among the text's blanks (0 = first). */
  index: number;
  start: number;
  end: number;
  /** A few words either side, to tell the blanks apart. */
  before: string;
  after: string;
}

export function findBlanks(text: string): GoalBlank[] {
  const blanks: GoalBlank[] = [];
  for (const m of (text ?? '').matchAll(BLANK)) {
    const start = m.index!;
    const end = start + m[0].length;
    const words = (s: string) => s.replace(/_{3,}/g, '___').trim().split(/\s+/).filter(Boolean);
    blanks.push({
      index: blanks.length, start, end,
      before: words(text.slice(Math.max(0, start - 60), start)).slice(-4).join(' '),
      after: words(text.slice(end, end + 60)).slice(0, 4).join(' '),
    });
  }
  return blanks;
}

/** The smallest "k out of n" (n of 2, 3, 4, 5, 10 or 20) equal to a percentage, or null. */
export function percentAsFraction(percent: number): [number, number] | null {
  for (const n of [2, 3, 4, 5, 10, 20]) {
    const k = (percent * n) / 100;
    if (Number.isInteger(k) && k > 0 && k <= n) return [k, n];
  }
  return null;
}

type BlankGoal = Partial<Pick<Goal, 'smartGoal' | 'sessionTargetValue' | 'masterySessions' | 'blankFills' | 'type' | 'dataCaptureType' | 'targetDirection'>>;

/** What each blank in the text is filled with automatically from the goal's settings (undefined when nothing fits). */
export function automaticBlankValues(text: string, goal: BlankGoal): (string | undefined)[] {
  const blanks = findBlanks(text);
  const values: (string | undefined)[] = blanks.map(() => undefined);
  const target = goal.sessionTargetValue;
  const fractionIsTarget = !statesPercent(text);
  blanks.forEach((blank, i) => {
    const after = text.slice(blank.end, blank.end + 20);
    if (target !== undefined && /^(?:\s?%|\s+percent\b)/i.test(after)) values[i] = String(target);
    if (/^\s*consecutive\b/i.test(after)) values[i] = String(goal.masterySessions ?? 3); // mastery's default, as in aim-line.ts
    // "___ out of ___": this blank and the next.
    const next = blanks[i + 1];
    if (target !== undefined && fractionIsTarget && next && /^\s+out of\s+$/i.test(text.slice(blank.end, next.start))) {
      const fraction = percentAsFraction(target);
      if (fraction) { values[i] = String(fraction[0]); values[i + 1] = String(fraction[1]); }
    }
  });
  return values;
}

/** The value shown for each blank: the one entered by hand, else the automatic one (undefined: left blank). */
export function blankValues(text: string, goal: BlankGoal): (string | undefined)[] {
  const automatic = automaticBlankValues(text, goal);
  return automatic.map((auto, i) => goal.blankFills?.[i]?.trim() || auto);
}

/** The text with its blanks filled where a value is known. */
export function fillBlanks(text: string, goal: BlankGoal): string {
  if (!text) return text ?? '';
  const values = blankValues(text, goal);
  let i = 0;
  return text.replace(BLANK, blank => values[i++] ?? blank);
}

/** Whether the text states a percentage (written, or a "___%" blank). Its fractions are then a separate criterion. */
function statesPercent(text: string): boolean {
  return /(?<![\d./])\d{1,3}(?:\.\d+)?(?:\s?%|\s+percent\b)|_{3,}(?:\s?%|\s+percent\b)/i.test(text);
}

const normalize = (s: string) => s.toLowerCase().replace(/_{3,}/g, '_').replace(/\s+/g, ' ').trim();

/**
 * The goal's name with blanks filled. Goal bank names are often the start of the goal text ("Initiate
 * communication using ___ ..."), so the name's blanks are matched to the text's blanks where the name appears in it.
 */
export function fillNameBlanks(goal: BlankGoal & { name: string }): string {
  const name = goal.name ?? '';
  if (!findBlanks(name).length || !goal.smartGoal) return name;
  const core = normalize(name.replace(/(\.\.\.|…)\s*$/, ''));
  const text = normalize(goal.smartGoal);
  const at = text.indexOf(core);
  if (at === -1) return name;
  const offset = (text.slice(0, at).match(/_/g) ?? []).length; // text blanks before the name starts
  const values = blankValues(goal.smartGoal, goal);
  let i = 0;
  return name.replace(BLANK, blank => values[offset + i++] ?? blank);
}

// Numbers written into the goal text follow the goal's settings too. Goal bank text states its target
// ("with 80% accuracy", "in 4 out of 5 opportunities", "across 3 consecutive sessions"), so when the target or
// mastery is changed the text shows the new values instead of contradicting them. Only text that states the target
// one way is changed (every percentage the same value, every fraction the same ratio), so other numbers stay.
// A fraction is the target only when the text states no percentage: in "with 80% accuracy in 4 out of 5
// opportunities" the accuracy is the target and "4 out of 5" is how many opportunities, set separately.

// Goal types whose target isn't a percentage (a count, a rating, minutes or seconds).
const NOT_PERCENT = new Set(['COMMUNICATION_FUNCTIONS', 'QUALITATIVE_OBSERVATION', 'COGNITIVE', 'BEHAVIOR_FREQUENCY', 'BEHAVIOR_DURATION', 'BEHAVIOR_LATENCY']);
function percentTarget(goal: BlankGoal): boolean {
  const type = goal.dataCaptureType || goal.type || '';
  if (type === 'BEHAVIOR_ABC') return goal.targetDirection === 'increase';
  return !NOT_PERCENT.has(type);
}

// "80%", "80 %" or "80 percent" (custom goals are often typed that way).
const PERCENT = /(?<![\d./])(\d{1,3}(?:\.\d+)?)(\s?%|\s+percent\b)/gi;
// What a fraction counts: "6 of 10 opportunities", "4/5 trials".
const COUNTED = '(?:\\w+\\s+)?(?:opportunit|trials?\\b|attempts?\\b|occasions?\\b|times\\b|items?\\b|questions?\\b|responses?\\b|turns?\\b|exchanges?\\b|prompts?\\b|words?\\b|sentences?\\b|tasks?\\b)';
// "4 out of 5" (not "2 out of 3 sessions", which is about sessions), "6 of 10 opportunities" and "4/5 trials"
// (a slash only before what is counted, so a date such as "6/15" is never taken for a fraction).
const FRACTION = new RegExp(
  `(?<![\\d/])\\b(\\d{1,3})(\\s+out of\\s+|\\s+of\\s+(?=\\d{1,3}\\s+${COUNTED})|\\s?/\\s?(?=\\d{1,3}\\s+${COUNTED}))(\\d{1,3})\\b(?![/\\d])` +
  `(?!\\s+(?:consecutive\\s+)?(?:sessions?|days?|weeks?|data|probes?)\\b)`, 'gi');
// Ratings ("with a rating of at least 4 out of 5") and communication functions ("at least 4 different functions").
const RATING = /\b(rating of at least )([1-5])( out of 5)\b/gi;
const FUNCTIONS = /\b(at least )(\d{1,2})( different (?:communicative )?functions)\b/gi;
const CONSECUTIVE = /\b(\d{1,2})(\s+consecutive\s+(?:sessions?|data|probes?|days?|weeks?|opportunit))/gi;

/** The goal text with its stated target, fractions and consecutive-session count matching the goal's settings. */
export function matchTextToTarget(text: string, goal: BlankGoal): string {
  if (!text) return text ?? '';
  let out = text;
  const target = goal.sessionTargetValue;
  if (target !== undefined && target !== null && percentTarget(goal)) {
    const percents = new Set([...out.matchAll(PERCENT)].map(m => Number(m[1])));
    if (percents.size === 1 && !percents.has(target)) out = out.replace(PERCENT, (_m, _n, unit) => `${target}${unit}`);
    const fractions = statesPercent(text) ? [] : [...out.matchAll(FRACTION)];
    const ratios = new Set(fractions.map(m => Math.round((Number(m[1]) / Number(m[3])) * 1000)));
    if (fractions.length && ratios.size === 1 && !ratios.has(Math.round(target * 10))) {
      out = out.replace(FRACTION, (whole, _k, between, n) => {
        const k = (target * Number(n)) / 100;
        if (Number.isInteger(k)) return `${k}${between}${n}`;
        const fraction = percentAsFraction(target);
        return fraction ? `${fraction[0]}${between}${fraction[1]}` : whole;
      });
    }
  }
  const type = goal.dataCaptureType || goal.type || '';
  if (target !== undefined && target !== null && (type === 'QUALITATIVE_OBSERVATION' || type === 'COGNITIVE') && target >= 1 && target <= 5) {
    out = out.replace(RATING, (_m, before, _n, after) => `${before}${target}${after}`);
  }
  if (target !== undefined && target !== null && type === 'COMMUNICATION_FUNCTIONS') {
    const counts = new Set([...out.matchAll(FUNCTIONS)].map(m => m[2]));
    if (counts.size === 1) out = out.replace(FUNCTIONS, (_m, before, _n, after) => `${before}${target}${after}`);
  }
  if (goal.masterySessions) out = out.replace(CONSECUTIVE, (_m, _n, rest) => `${goal.masterySessions}${rest}`);
  return out;
}
