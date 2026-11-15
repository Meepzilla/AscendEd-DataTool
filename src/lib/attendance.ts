import type { SessionData } from './types';

// Missed sessions (Data Entry → a student card's Missed button): a session that didn't happen is saved with a
// reason and no goal data, so attendance can be reported (sessions held and missed, and why) while the progress
// figures only use sessions that took place.

export const MISSED_REASONS = ['student-absent', 'student-unavailable', 'provider-absent', 'no-school', 'other'] as const;
export type MissedReason = typeof MISSED_REASONS[number];

export const MISSED_REASON_LABELS: Record<MissedReason, string> = {
  'student-absent': 'Student absent',
  'student-unavailable': 'Student unavailable (testing, field trip, other activity)',
  'provider-absent': 'Provider absent',
  'no-school': 'No school or school event',
  other: 'Other',
};

/** Short labels for summaries and tables. */
export const MISSED_REASON_SHORT: Record<MissedReason, string> = {
  'student-absent': 'Student absent',
  'student-unavailable': 'Student unavailable',
  'provider-absent': 'Provider absent',
  'no-school': 'No school',
  other: 'Other',
};

export const isMissed = (session: Pick<SessionData, 'missed'>) => !!session.missed;

/**
 * The missed reason from a CSV export's Attendance cell ("Missed: Student absent"), so an imported missed session
 * stays missed with its reason; null for "Held" or an empty cell. A reason it doesn't recognize is "other".
 */
export function missedReasonFromCsv(cell: unknown): MissedReason | null {
  const text = String(cell ?? '').trim();
  const match = /^missed\b\s*:?\s*(.*)$/i.exec(text);
  if (!match) return null;
  const label = match[1].trim().toLowerCase();
  const found = MISSED_REASONS.find(reason =>
    MISSED_REASON_SHORT[reason].toLowerCase() === label || MISSED_REASON_LABELS[reason].toLowerCase() === label || reason === label);
  return found ?? 'other';
}

export interface AttendanceSummary {
  held: number;
  missed: number;
  byReason: { reason: MissedReason; count: number }[];
}

export function attendanceSummary(sessions: Pick<SessionData, 'missed'>[]): AttendanceSummary {
  const counts = new Map<MissedReason, number>();
  let missed = 0;
  for (const s of sessions) {
    if (!s.missed) continue;
    missed++;
    counts.set(s.missed.reason, (counts.get(s.missed.reason) ?? 0) + 1);
  }
  return {
    held: sessions.length - missed,
    missed,
    byReason: MISSED_REASONS.filter(r => counts.has(r)).map(reason => ({ reason, count: counts.get(reason)! })),
  };
}

/** e.g. "12 held · 2 missed (Student absent 1, Provider absent 1)". */
export function attendanceText(summary: AttendanceSummary): string {
  const missed = summary.missed
    ? ` · ${summary.missed} missed (${summary.byReason.map(r => `${MISSED_REASON_SHORT[r.reason]} ${r.count}`).join(', ')})`
    : ' · none missed';
  return `${summary.held} held${missed}`;
}

// ---- Attendance over time: by month (chart) and by day (calendar) ----

type DatedSession = Pick<SessionData, 'missed' | 'date'>;

/** A session's local day as YYYY-MM-DD ('' when its date can't be read). A date-only value is that day. */
export function sessionDayKey(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface AttendanceMonth {
  /** YYYY-MM. */
  month: string;
  held: number;
  missed: number;
  byReason: Record<MissedReason, number>;
  /** Held ÷ (held + missed) × 100, to a whole number. */
  percentHeld: number;
}

const emptyReasons = (): Record<MissedReason, number> =>
  Object.fromEntries(MISSED_REASONS.map(r => [r, 0])) as Record<MissedReason, number>;

/** Sessions held and missed (by reason) in each month that has any, oldest month first. */
export function attendanceByMonth(sessions: DatedSession[]): AttendanceMonth[] {
  const months = new Map<string, AttendanceMonth>();
  for (const s of sessions) {
    const day = sessionDayKey(s.date);
    if (!day) continue;
    const key = day.slice(0, 7);
    const row = months.get(key) ?? { month: key, held: 0, missed: 0, byReason: emptyReasons(), percentHeld: 0 };
    if (s.missed) {
      row.missed++;
      // A reason this version doesn't know (from a newer backup) counts as "other".
      row.byReason[MISSED_REASONS.includes(s.missed.reason) ? s.missed.reason : 'other']++;
    } else {
      row.held++;
    }
    months.set(key, row);
  }
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(row => ({ ...row, percentHeld: Math.round((row.held / (row.held + row.missed)) * 100) }));
}

export interface AttendanceDay {
  held: number;
  /** The reason of each missed session that day. */
  missed: MissedReason[];
}

/** What happened on each day with a session, by YYYY-MM-DD. */
export function attendanceByDay(sessions: DatedSession[]): Map<string, AttendanceDay> {
  const days = new Map<string, AttendanceDay>();
  for (const s of sessions) {
    const key = sessionDayKey(s.date);
    if (!key) continue;
    const day = days.get(key) ?? { held: 0, missed: [] };
    if (s.missed) day.missed.push(MISSED_REASONS.includes(s.missed.reason) ? s.missed.reason : 'other');
    else day.held++;
    days.set(key, day);
  }
  return days;
}

/**
 * The share of sessions held, two ways: of all scheduled sessions, and leaving out the ones missed for a
 * reason that wasn't the student's (provider absent, no school), which is the student's own attendance.
 * Null where there is nothing to divide by.
 */
export function attendanceRates(summary: AttendanceSummary): { overall: number | null; student: number | null } {
  const count = (reason: MissedReason) => summary.byReason.find(r => r.reason === reason)?.count ?? 0;
  const total = summary.held + summary.missed;
  const studentTotal = total - count('provider-absent') - count('no-school');
  const percent = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : null);
  return { overall: percent(summary.held, total), student: percent(summary.held, studentTotal) };
}

/** The weeks of a month for a calendar: rows of 7 days, Sunday first, null outside the month. `month` is YYYY-MM. */
export function calendarWeeks(month: string): (string | null)[][] {
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const days = new Date(year, m, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
