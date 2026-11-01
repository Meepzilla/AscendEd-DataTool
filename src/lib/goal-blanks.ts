import type { Goal } from './types';

// Blanks in goal text (goal bank wording such as "using ______ (AAC device) ... in ___ out of ___ opportunities
// as measured by ______"). A run of three or more underscores is a blank. Blanks are filled where the goal is
// shown (its text and name), the same way "[date]" and "STUDENT" are; the stored text keeps its blanks.
// - Blanks the goal's own settings can answer are filled automatically: "___%" with the target, "___ out of ___"
//   with the target as a fraction (80% → 4 out of 5), and "___ consecutive" with the mastery sessions.
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

type BlankGoal = Partial<Pick<Goal, 'smartGoal' | 'sessionTargetValue' | 'masterySessions' | 'blankFills'>>;

/** What each blank in the text is filled with automatically from the goal's settings (undefined when nothing fits). */
export function automaticBlankValues(text: string, goal: BlankGoal): (string | undefined)[] {
  const blanks = findBlanks(text);
  const values: (string | undefined)[] = blanks.map(() => undefined);
  const target = goal.sessionTargetValue;
  blanks.forEach((blank, i) => {
    const after = text.slice(blank.end, blank.end + 20);
    if (target !== undefined && /^\s?%/.test(after)) values[i] = String(target);
    if (/^\s*consecutive\b/i.test(after)) values[i] = String(goal.masterySessions ?? 3); // mastery's default, as in aim-line.ts
    // "___ out of ___": this blank and the next.
    const next = blanks[i + 1];
    if (target !== undefined && next && /^\s+out of\s+$/i.test(text.slice(blank.end, next.start))) {
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
