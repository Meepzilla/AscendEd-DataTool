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
