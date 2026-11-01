import type { ServicePer, SessionData, Student } from './types';
import { daysUntil, servicePeriods, sessionMinutes } from './student-overview';

// What the dashboard's "Due soon" and "Service minutes" sections show, worked out from the students' IEP
// details and their sessions (the same figures as each student's Overview).

/** IEP reviews due within this many days (or already overdue) are listed. */
export const DUE_SOON_DAYS = 60;

export interface DueItem {
  studentId: string;
  studentName: string;
  kind: 'Annual review' | 'Re-evaluation';
  /** YYYY-MM-DD */
  date: string;
  /** Whole days from today (negative when overdue). */
  days: number;
}

/** Annual reviews and re-evaluations that are overdue or due within `within` days, soonest (most overdue) first. */
export function dueSoon(students: Pick<Student, 'id' | 'name' | 'isArchived' | 'iep'>[], now = new Date(), within = DUE_SOON_DAYS): DueItem[] {
  const items: DueItem[] = [];
  for (const student of students) {
    if (student.isArchived) continue;
    const dates: [DueItem['kind'], string | undefined][] = [['Annual review', student.iep?.annualReviewDate], ['Re-evaluation', student.iep?.reevaluationDate]];
    for (const [kind, date] of dates) {
      if (!date) continue;
      const days = daysUntil(date, now);
      if (Number.isNaN(days) || days > within) continue;
      items.push({ studentId: student.id, studentName: student.name, kind, date, days });
    }
  }
  return items.sort((a, b) => a.days - b.days || a.studentName.localeCompare(b.studentName));
}

export interface ServiceItem {
  studentId: string;
  studentName: string;
  required: number;
  per: ServicePer;
  /** Minutes delivered so far this week, month or school year. */
  delivered: number;
  /** 'needed': minutes still to deliver this week or month. 'pace': minutes behind an even pace through the school year. */
  kind: 'needed' | 'pace';
  minutes: number;
  /** Minutes short of the requirement in the week or month before this one (0 for school-year requirements). */
  lastShort: number;
  /** Days left in the week or month, today included (0 for school-year requirements). */
  daysLeft: number;
}

export interface ServiceStatus {
  /** Students with required minutes set. */
  tracked: number;
  /** Those who still need minutes (this week or month) or are behind pace (school year), most behind first. */
  behind: ServiceItem[];
}

const DAY = 86_400_000;

/**
 * Who still needs service minutes. A weekly or monthly requirement counts what is left this week or month, and
 * how short the one before was. A school-year requirement is compared with an even pace through the year, so
 * nobody looks behind on the first day. Held sessions with both start and end times count; missed ones don't.
 */
export function serviceStatus(
  students: Pick<Student, 'id' | 'name' | 'isArchived' | 'iep'>[],
  sessions: Pick<SessionData, 'studentId' | 'date' | 'time' | 'endTime' | 'missed'>[],
  now = new Date(),
): ServiceStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const behind: ServiceItem[] = [];
  let tracked = 0;
  for (const student of students) {
    const required = student.iep?.serviceMinutes;
    if (student.isArchived || !required || required <= 0) continue;
    tracked++;
    const per = student.iep?.servicePer ?? 'week';
    const held = sessions.filter(s => s.studentId === student.id && !s.missed);
    const minutesIn = (from: Date, to: Date) => held
      .filter(s => { const t = new Date(s.date).getTime(); return t >= from.getTime() && t < to.getTime(); })
      .reduce((sum, s) => sum + sessionMinutes(s), 0);
    const { current, previous } = servicePeriods(per, now);
    const delivered = minutesIn(current.start, current.end);
    const base = { studentId: student.id, studentName: student.name, required, per, delivered };
    if (per === 'year') {
      const span = current.end.getTime() - current.start.getTime();
      const elapsed = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - current.start.getTime()) / span)) : 0;
      const short = Math.round(required * elapsed - delivered);
      if (short > 0) behind.push({ ...base, kind: 'pace', minutes: short, lastShort: 0, daysLeft: 0 });
    } else if (delivered < required) {
      behind.push({
        ...base, kind: 'needed', minutes: required - delivered,
        lastShort: Math.max(0, required - minutesIn(previous.start, previous.end)),
        daysLeft: Math.max(1, Math.ceil((current.end.getTime() - today) / DAY)),
      });
    }
  }
  behind.sort((a, b) => Number(b.lastShort > 0) - Number(a.lastShort > 0) || b.minutes - a.minutes || a.studentName.localeCompare(b.studentName));
  return { tracked, behind };
}
