import type { CustomGoalType, Goal, SessionData, StudentIep } from './types';
import { fillBlanks, matchTextToTarget, percentAsFraction } from './goal-blanks';
import { replacePlaceholders, type PlaceholderKey } from './goal-placeholders';
import { makeCustomDef } from './goal-types/custom';
import { formatSampleLength, sampleUnit } from './language-sample';

/**
 * Minutes between a session's start and end time ("HH:MM"); null when either is missing or invalid, or the
 * span isn't sensible (over 600 minutes, negative, or end before start). Null is untimed, not 0 minutes:
 * callers must not add it to a total.
 */
export function sessionMinutes(session: Pick<SessionData, 'time' | 'endTime'>): number | null {
  const toMinutes = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? '');
    if (!m) return null;
    const hours = Number(m[1]), minutes = Number(m[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  };
  const start = toMinutes(session.time);
  const end = toMinutes(session.endTime);
  if (start === null || end === null) return null;
  const span = end - start;
  return span > 0 && span <= 600 ? span : null;
}

export function formatDate(date: Date | string): string {
  if (!date) return 'Invalid Date';
  let d: Date;
  if (typeof date === 'string') {
    // A date-only value (YYYY-MM-DD) is a stored day, not an instant, so it reads as that day in local
    // time, the same rule as formatDateOnly and parseDateOnly. Reading one as UTC midnight shows the
    // day before in timezones behind UTC.
    d = parseDateOnly(date);
  } else {
    d = date;
  }
  
  if (isNaN(d.getTime())) return 'Invalid Date';

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A date-only value (YYYY-MM-DD) as a date, read as that day in local time (not UTC, which can show the day before). */
export function formatDateOnly(value: string): string {
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00`) : value);
}

/** A date as YYYY-MM-DD on the local calendar (toISOString gives the UTC day, which is tomorrow on a US evening). */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whether a year, month and day are a real calendar date (so 2026-02-30 is not: it would roll to Mar 2). */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  // The last day of the month: the day before the 1st of the next month (leap years included).
  return day <= new Date(year, month, 0).getDate();
}

/**
 * A stored date as a Date: a YYYY-MM-DD value reads as that day at local midnight, anything else as given.
 * A YYYY-MM-DD value that isn't a real day (2026-02-30) is an Invalid Date, not the day it would roll to, so
 * every caller's existing "can't be read" handling applies.
 */
export function parseDateOnly(value: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!day) return new Date(value);
  return isRealDate(+day[1], +day[2], +day[3]) ? new Date(`${value}T00:00`) : new Date(Number.NaN);
}

/** The largest file an import accepts (10 MB); bigger files are rejected before they are read. */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/** Throws when an import file is over the size limit, naming the limit so the message can be shown as-is. */
export function checkImportFileSize(bytes: number): void {
  if (bytes > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`This file is larger than 10 MB (${(bytes / (1024 * 1024)).toFixed(1)} MB), so it can't be imported. Split it into smaller files and try again.`);
  }
}

/**
 * A goal's session target as shown to the user: a percentage for most goal types, a 1-5 rating for
 * qualitative observations, a number of different functions for communication functions, and for
 * behavior goals a count, minutes, % or seconds with "≤" (decrease goals, the default) or "≥" (increase goals).
 */
export function formatGoalTarget(
  typeOrGoal: string | { type: string; dataCaptureType?: string; targetDirection?: 'increase' | 'decrease'; sessionTargetUses?: number; customType?: CustomGoalType; sampleUnit?: 'words' | 'morphemes' },
  target: number,
  direction?: 'increase' | 'decrease',
  usesTarget?: number,
  customType?: CustomGoalType,
): string {
  const ct = typeof typeOrGoal === 'object' ? typeOrGoal.customType : customType;
  const type = typeof typeOrGoal === 'object' ? (typeOrGoal.dataCaptureType || typeOrGoal.type) : typeOrGoal;
  const dir = direction ?? (typeof typeOrGoal === 'object' ? typeOrGoal.targetDirection : undefined);
  const uses = usesTarget ?? (typeof typeOrGoal === 'object' ? typeOrGoal.sessionTargetUses : undefined);
  if (type === 'CUSTOM' && ct) {
    return makeCustomDef(ct).formatTarget({ type: 'CUSTOM', customType: ct, targetDirection: dir }, target, dir, uses);
  }
  // Communication goals measured by a count, minutes or seconds: "at least" unless set to decrease (a response
  // time aims down by default).
  if (type === 'COMMUNICATION_COUNT' || type === 'COMMUNICATION_DURATION' || type === 'RESPONSE_TIME') {
    const sign = (dir ?? (type === 'RESPONSE_TIME' ? 'decrease' : 'increase')) === 'decrease' ? '≤' : '≥';
    if (type === 'COMMUNICATION_COUNT') return `${sign} ${target} per session`;
    if (type === 'COMMUNICATION_DURATION') return `${sign} ${target} min`;
    return `${sign} ${target} s average`;
  }
  if (type === 'COMMUNICATION_OPPORTUNITIES') return `${target}% of opportunities`;
  if (type === 'LANGUAGE_SAMPLE') return `MLU ≥ ${formatSampleLength(target, sampleUnit(typeof typeOrGoal === 'object' ? typeOrGoal : null))}`;
  if (type === 'ITEM_MASTERY') return `${target}% of items correct`;
  if (type.startsWith('BEHAVIOR_')) {
    const sign = (dir ?? 'decrease') === 'decrease' ? '≤' : '≥';
    if (type === 'BEHAVIOR_FREQUENCY') return `${sign} ${target} per session`;
    if (type === 'BEHAVIOR_DURATION') return `${sign} ${target} min`;
    if (type === 'BEHAVIOR_INTERVAL') return `${sign} ${target}% of intervals`;
    if (type === 'BEHAVIOR_LATENCY') return `${sign} ${target} s average`;
    return dir === 'increase' ? `≥ ${target}% replacement skill` : `≤ ${plural(target, 'incident')}`;
  }
  if (type === 'COMMUNICATION_FUNCTIONS') {
    // A goal worded "at least 5 times for at least 2 different functions" carries both halves.
    return uses && uses > 0
      ? `${plural(target, 'function')} and at least ${plural(uses, 'use')}`
      : plural(target, 'function');
  }
  // Goal Attainment Scaling: the target is a level, not a percentage — 0 is the expected outcome.
  if (type === 'GOAL_ATTAINMENT_SCALE') return target === 0 ? 'level 0 (expected outcome)' : `level ${target}`;
  // Observation and cognitive goals are rated 1-5.
  if (type.startsWith('QUALITATIVE') || type === 'COGNITIVE') return `${target} out of 5`;
  return `${target}%`;
}

/** Whether every word of `search` appears in a goal template's name, goal text or skill area. */
export function templateMatchesSearch(template: { name: string; generatedSmartGoal?: string; category?: string }, search: string): boolean {
  const text = `${template.name} ${template.generatedSmartGoal || ''} ${template.category || ''}`.toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

// Template pickers render at most this many matches; the goal bank has over 1,000 templates.
export const TEMPLATE_PICKER_LIMIT = 100;

/**
 * A stored goal data value as readable text: lists are joined, ABC incidents read
 * "time: antecedent → behavior → consequence", interval records read "+ − ·", other objects as "key: value" pairs.
 */
export function formatDataValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.some(item => typeof item === 'boolean') && value.every(item => typeof item === 'boolean' || item === null)) {
      return value.map(item => (item === true ? '+' : item === false ? '−' : '·')).join(' ');
    }
    return value.map(item => {
      if (item && typeof item === 'object' && 'behavior' in item) {
        const i = item as { time?: string; antecedent?: string; behavior?: string; consequence?: string; note?: string };
        const time = i.time ? new Date(i.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ': ' : '';
        return `${time}${[i.antecedent || '?', i.behavior, i.consequence || '?'].join(' → ')}${i.note ? ` (${i.note})` : ''}`;
      }
      return formatDataValue(item);
    }).join('; ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${formatDataValue(v)}`).join(', ');
  }
  return String(value);
}

/** A goal type as shown to the user, e.g. "Behavior Frequency", "AAC", "Behavior ABC", or a custom type's name. */
export function goalTypeLabel(
  typeOrGoal: string | { type: string; dataCaptureType?: string; customType?: CustomGoalType },
  customType?: CustomGoalType,
): string {
  const ct = typeof typeOrGoal === 'object' ? typeOrGoal.customType : customType;
  const type = typeof typeOrGoal === 'object' ? (typeOrGoal.dataCaptureType || typeOrGoal.type) : typeOrGoal;
  if (type === 'CUSTOM' && ct?.name) return ct.name;
  return type.split('_').map(word => (word === 'AAC' || word === 'ABC') ? word : word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
}

/** "1 student", "2 students". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function studentProfilePath(studentId: string): string {
  return `/student-profile/view?id=${encodeURIComponent(studentId)}`;
}

export function generateUUID(): string {
  // The browser's secure generator where there is one (crypto.randomUUID needs https; getRandomValues doesn't).
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * When a session started, for ordering: its day at its start time when one was entered (Data Entry stamps
 * every session saved from one sitting with the same date, so two sessions on a day differ only by time).
 */
export function sessionTimestamp(session: { date: string; time?: string }): number {
  const date = parseDateOnly(session.date);
  const match = /^(\d{1,2}):(\d{2})/.exec(session.time || '');
  if (Number.isNaN(date.getTime()) || !match) return date.getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(match[1]), Number(match[2])).getTime();
}

type SortKeys = { date: string; time?: string; at: number; stored: number };
// Each session's two sort keys, worked out once per session object. Sorting thousands of sessions called the
// comparator over a hundred thousand times, each building several Dates: the whole list was sorted on every save,
// which took a large part of the save on a long caseload. A key is reused only while the date and time it came from
// are unchanged (sessions are replaced, not edited in place, but this doesn't rely on it).
const sortKeyCache = new WeakMap<object, SortKeys>();
function sessionSortKeys(s: { date: string; time?: string }): SortKeys {
  const cached = sortKeyCache.get(s);
  if (cached && cached.date === s.date && cached.time === s.time) return cached;
  const at = sessionTimestamp(s);
  const stored = parseDateOnly(s.date).getTime();
  // A session whose date can't be read sorts last (NaN in a comparator leaves the whole order undefined).
  const keys = { date: s.date, time: s.time, at: Number.isNaN(at) ? Infinity : at, stored: Number.isNaN(stored) ? Infinity : stored };
  sortKeyCache.set(s, keys);
  return keys;
}

/** Orders sessions oldest first (by sessionTimestamp, then the stored date). */
export function compareSessionsOldestFirst(a: { date: string; time?: string }, b: { date: string; time?: string }): number {
  const ka = sessionSortKeys(a);
  const kb = sessionSortKeys(b);
  const byTime = ka.at === kb.at ? 0 : ka.at - kb.at;
  return byTime || (ka.stored === kb.stored ? 0 : ka.stored - kb.stored);
}

/** The most recent of some session dates, as stored; dates that can't be read are passed over (null if none can). */
export function latestSessionDate(dates: string[]): string | null {
  let latest: string | null = null;
  let latestTime = -Infinity;
  for (const date of dates) {
    const time = parseDateOnly(date).getTime();
    if (time > latestTime) { latest = date; latestTime = time; }
  }
  return latest;
}

/**
 * Whether a session's date is within a range picked in the app: on or after the start of `from`'s day and on or
 * before the end of `to`'s day (either end may be left open). A date-only session date, as imported sessions have,
 * counts as that local day, not the evening before. A session whose date can't be read is outside any range that is set; with no range it is still listed, so a record with a damaged date stays visible (and can be edited or deleted).
 */
export function sessionInDateRange(date: string, from?: Date | null, to?: Date | null): boolean {
  const when = parseDateOnly(date).getTime();
  if (Number.isNaN(when)) return !from && !to;
  if (from && when < new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) return false;
  if (to && when > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime()) return false;
  return true;
}

/**
 * The goal statement with the goal bank's placeholders filled in: blanks ("___", see goal-blanks.ts), the stated target
 * and mastery matching the goal's settings, "[date]" with
 * the goal's target date, and "STUDENT" / "the student" with the student's first name. The stored text is unchanged.
 */
type StatementGoal = Pick<Goal, 'smartGoal' | 'targetDate' | 'sessionTargetValue' | 'masterySessions' | 'blankFills'>
  & Partial<Pick<Goal, 'type' | 'dataCaptureType' | 'targetDirection' | 'baseline' | 'baselineDate' | 'customType'>>;

/**
 * The value of each placeholder in goal text (goal-placeholders.ts) for a goal and its student. Without a student
 * (a template), [student] reads "the student"; a placeholder with no value set is left as typed.
 */
export function placeholderValue(key: PlaceholderKey, goal: StatementGoal, studentName?: string, iep?: StudentIep): string | undefined {
  const name = studentName?.trim();
  const type = goal.dataCaptureType || goal.type || '';
  const target = goal.sessionTargetValue;
  // A target shown as a percentage (accuracy, % of intervals…) keeps its "%"; counts and ratings are plain numbers.
  const percent = target !== undefined && formatGoalTarget(type, target, goal.targetDirection, undefined, goal.customType).includes('%');
  const withUnit = (v: number) => `${v}${percent ? '%' : ''}`;
  const date = (v?: string) => (v ? formatDateOnly(v) : undefined);
  switch (key) {
    case 'student': return name ? name.split(/\s+/)[0] : 'the student';
    case 'fullName': return name || 'the student';
    case 'date': return date(goal.targetDate || iep?.annualReviewDate);
    case 'target': return target === undefined ? undefined : withUnit(target);
    case 'opportunities': {
      const fraction = percent && target !== undefined ? percentAsFraction(target) : null;
      return fraction ? `${fraction[0]} out of ${fraction[1]}` : undefined;
    }
    case 'mastery': return String(goal.masterySessions ?? 3); // mastery's default, as in aim-line.ts
    case 'baseline': return goal.baseline === undefined || goal.baseline === null ? undefined : withUnit(Number(goal.baseline));
    case 'baselineDate': return date(goal.baselineDate);
    case 'annualReview': return date(iep?.annualReviewDate);
    case 'iepDate': return date(iep?.iepDate);
    case 'reevaluation': return date(iep?.reevaluationDate);
    case 'serviceMinutes':
      return iep?.serviceMinutes ? `${iep.serviceMinutes} minutes per ${iep.servicePer === 'year' ? 'school year' : iep.servicePer ?? 'week'}` : undefined;
  }
}

/**
 * A goal's text as shown: blanks ("___") filled, the stated target and mastery following the goal's settings,
 * placeholders ("[student]", "[date]", "[opportunities]"…) filled from the student and the goal, and "STUDENT" or
 * "the student" as the student's first name.
 */
export function goalStatement(goal: StatementGoal, studentName?: string, iep?: StudentIep): string {
  // Blanks ("___") first: their positions are in the stored text. Then the stated target and mastery follow the
  // goal's settings (goal-blanks.ts).
  let text = matchTextToTarget(fillBlanks(goal.smartGoal ?? '', goal), goal);
  text = replacePlaceholders(text, key => placeholderValue(key, goal, studentName, iep));
  const firstName = studentName?.trim().split(/\s+/)[0];
  if (firstName) text = text.replace(/\bSTUDENT\b/g, firstName).replace(/\b[Tt]he student\b/g, firstName);
  // "[student] will…" at the start of a sentence in a template: "The student will…".
  else text = text.replace(/(^|[.!?]\s+)the student\b/g, (_, before: string) => `${before}The student`);
  return text;
}
