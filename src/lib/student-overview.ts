import type { ServicePer, SessionData, StudentIep } from './types';
import { attendanceSummary, type AttendanceSummary } from './attendance';
import { dateValue } from './aim-line';
import { schoolYearRange } from './school-year';

// Figures for the student profile's Overview: IEP dates (days until each is due), service minutes delivered
// against what the IEP requires (from the sessions' start and end times), and attendance for the school year.

export { schoolYearStart } from './school-year';

/** Minutes between a session's start and end time ("HH:MM"); 0 when either is missing or the span isn't sensible. */
export function sessionMinutes(session: Pick<SessionData, 'time' | 'endTime'>): number {
  const toMinutes = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const start = toMinutes(session.time);
  const end = toMinutes(session.endTime);
  if (start === null || end === null) return 0;
  const span = end - start;
  return span > 0 && span <= 600 ? span : 0;
}

/** The current week (Monday to Sunday), month or school year containing `now`, and the one before it. */
export function servicePeriods(per: ServicePer, now = new Date()) {
  if (per === 'year') {
    const current = schoolYearRange(now);
    const before = new Date(current.start.getFullYear(), current.start.getMonth(), current.start.getDate() - 1);
    return { current, previous: schoolYearRange(before) };
  }
  if (per === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { current: { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }, previous: { start: prevStart, end: start } };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { current: { start, end }, previous: { start: prevStart, end: start } };
}

export interface ServiceSummary {
  required: number | null;
  per: ServicePer;
  thisPeriod: number;
  lastPeriod: number;
  schoolYear: number;
  /** Held sessions in the school year without both times, so their minutes aren't counted. */
  untimed: number;
}

export interface StudentOverview {
  service: ServiceSummary;
  attendance: AttendanceSummary;
  /** Held sessions out of held + missed this school year, as a percentage (null without any). */
  attendanceRate: number | null;
  lastSessionDate: string | null;
}

export function studentOverview(sessions: SessionData[], iep: StudentIep | undefined, now = new Date()): StudentOverview {
  const year = schoolYearRange(now);
  const inYear = sessions.filter(s => { const t = new Date(s.date).getTime(); return t >= year.start.getTime() && t < year.end.getTime(); });
  const held = sessions.filter(s => !s.missed);
  const per = iep?.servicePer ?? 'week';
  const { current, previous } = servicePeriods(per, now);
  const minutesIn = (from: Date, to: Date) => held
    .filter(s => { const t = new Date(s.date).getTime(); return t >= from.getTime() && t < to.getTime(); })
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
  const heldInYear = inYear.filter(s => !s.missed);
  const attendance = attendanceSummary(inYear);
  const total = attendance.held + attendance.missed;
  const last = held.reduce<string | null>((latest, s) => (!latest || new Date(s.date) > new Date(latest) ? s.date : latest), null);
  return {
    service: {
      required: iep?.serviceMinutes && iep.serviceMinutes > 0 ? iep.serviceMinutes : null,
      per,
      thisPeriod: minutesIn(current.start, current.end),
      lastPeriod: minutesIn(previous.start, previous.end),
      schoolYear: heldInYear.reduce((sum, s) => sum + sessionMinutes(s), 0),
      untimed: heldInYear.filter(s => sessionMinutes(s) === 0).length,
    },
    attendance,
    attendanceRate: total ? Math.round((attendance.held / total) * 100) : null,
    lastSessionDate: last,
  };
}

/** Whole days from today until a YYYY-MM-DD date (negative when it has passed). */
export function daysUntil(date: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dateValue(date) - today) / 86_400_000);
}

/** e.g. "2 h 15 min", "45 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
