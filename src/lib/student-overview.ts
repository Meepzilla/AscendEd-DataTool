import type { ServicePer, ServiceRequirement, ServiceType, SessionData, StudentIep } from './types';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES } from './types';
import { attendanceSummary, type AttendanceSummary } from './attendance';
import { dateValue } from './aim-line';
import { parseDateOnly } from './helpers';
import { schoolYearRange } from './school-year';

// Figures for the student profile's Overview: IEP dates (days until each is due), service minutes delivered
// against what the IEP requires (from the sessions' start and end times), and attendance for the school year.

export { schoolYearStart } from './school-year';

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

/**
 * The IEP's required-minutes lines, one per service type. An explicit services list wins; otherwise the
 * legacy single line becomes one Related Service requirement. Duplicated types keep the first line, and
 * lines at or under 0 minutes are dropped.
 */
export function serviceLines(iep: StudentIep | undefined): ServiceRequirement[] {
  if (iep?.services && iep.services.length > 0) {
    const seen = new Set<ServiceType>();
    const lines: ServiceRequirement[] = [];
    for (const line of iep.services) {
      if (!SERVICE_TYPES.includes(line.type) || seen.has(line.type) || !(line.minutes > 0)) continue;
      seen.add(line.type);
      lines.push({ type: line.type, minutes: line.minutes, per: line.per });
    }
    return lines;
  }
  if (iep?.serviceMinutes && iep.serviceMinutes > 0) {
    return [{ type: 'related', minutes: iep.serviceMinutes, per: iep.servicePer ?? 'week' }];
  }
  return [];
}

/**
 * How one session's minutes divide across service types. An explicit split on the session wins (after
 * sanitizing: known types only, finite numbers over 0, rounded). Without one, the whole timed session
 * counts as Related Service. Missed and untimed sessions contribute nothing.
 */
export function sessionServiceMinutes(session: SessionData): Partial<Record<ServiceType, number>> {
  if (session.missed) return {};
  if (session.serviceMinutes) {
    const clean: Partial<Record<ServiceType, number>> = {};
    let total = 0;
    for (const type of SERVICE_TYPES) {
      const value = session.serviceMinutes[type];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        clean[type] = Math.round(value);
        total += clean[type];
      }
    }
    if (total > 0) return clean;
  }
  const duration = sessionMinutes(session);
  return duration !== null ? { related: duration } : {};
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

/** One service type's figures on the Overview: its own requirement and period, minutes beside it. */
export interface ServiceLineSummary {
  type: ServiceType;
  label: string;
  required: number | null;
  per: ServicePer;
  thisPeriod: number;
  lastPeriod: number;
  schoolYear: number;
}

export interface StudentOverview {
  service: ServiceSummary;
  /** Per-type breakdown of the totals in `service`, one entry per requirement line. */
  lines: ServiceLineSummary[];
  attendance: AttendanceSummary;
  /** Held sessions out of held + missed this school year, as a percentage (null without any). */
  attendanceRate: number | null;
  lastSessionDate: string | null;
}

export function studentOverview(sessions: SessionData[], iep: StudentIep | undefined, now = new Date()): StudentOverview {
  const year = schoolYearRange(now);
  // A stored YYYY-MM-DD reads as that day at local midnight; new Date on it would be UTC midnight and put
  // a first-day session (e.g. Aug 1) before the school year's first day in US timezones.
  const inYear = sessions.filter(s => { const t = parseDateOnly(s.date).getTime(); return t >= year.start.getTime() && t < year.end.getTime(); });
  const held = sessions.filter(s => !s.missed);
  const lines = serviceLines(iep);
  // The totals keep the single-period view: when every line shares one period, that period and the
  // summed requirement; with mixed periods the requirement can't be stated in one number, so it is null.
  const per = lines.length > 0 ? lines[0].per : (iep?.servicePer ?? 'week');
  const totalRequired = lines.length > 0 && lines.every(l => l.per === per) ? lines.reduce((sum, l) => sum + l.minutes, 0) : null;
  const { current, previous } = servicePeriods(per, now);
  const minutesIn = (from: Date, to: Date) => held
    .filter(s => { const t = parseDateOnly(s.date).getTime(); return t >= from.getTime() && t < to.getTime(); })
    .reduce((sum, s) => sum + (sessionMinutes(s) ?? 0), 0);
  const typeMinutesIn = (type: ServiceType, from: Date, to: Date) => held
    .filter(s => { const t = parseDateOnly(s.date).getTime(); return t >= from.getTime() && t < to.getTime(); })
    .reduce((sum, s) => sum + (sessionServiceMinutes(s)[type] ?? 0), 0);
  const heldInYear = inYear.filter(s => !s.missed);
  const attendance = attendanceSummary(inYear);
  const total = attendance.held + attendance.missed;
  const last = held.reduce<string | null>((latest, s) => (!latest || parseDateOnly(s.date) > parseDateOnly(latest) ? s.date : latest), null);
  return {
    service: {
      required: totalRequired,
      per,
      thisPeriod: minutesIn(current.start, current.end),
      lastPeriod: minutesIn(previous.start, previous.end),
      schoolYear: heldInYear.reduce((sum, s) => sum + (sessionMinutes(s) ?? 0), 0),
      untimed: heldInYear.filter(s => sessionMinutes(s) === null).length,
    },
    lines: lines.map(line => {
      const periodsForLine = servicePeriods(line.per, now);
      return {
        type: line.type,
        label: SERVICE_TYPE_LABELS[line.type],
        required: line.minutes,
        per: line.per,
        thisPeriod: typeMinutesIn(line.type, periodsForLine.current.start, periodsForLine.current.end),
        lastPeriod: typeMinutesIn(line.type, periodsForLine.previous.start, periodsForLine.previous.end),
        schoolYear: heldInYear.reduce((sum, s) => sum + (sessionServiceMinutes(s)[line.type] ?? 0), 0),
      };
    }),
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

/** e.g. "2 h 15 min", "45 min". The total is rounded first, so 119.6 shows "2 h", never "1 h 60 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

export interface PeriodServiceByType {
  type: ServiceType;
  label: string;
  /** Minutes of this type delivered in the reporting period. */
  delivered: number;
  /** This type's requirement per its own period (null when the IEP has no line for the type). */
  required: number | null;
  /** The requirement added up over the reporting period, using this line's own period math. */
  expected: number | null;
}

export interface PeriodService {
  /** Minutes delivered in the period (held sessions' start to end times). */
  delivered: number;
  /** Held sessions without both times, so not counted. */
  untimed: number;
  required: number | null;
  per: ServicePer;
  /** Weeks or months in the period (for per week/month requirements). */
  periods: number;
  /** Minutes the requirement adds up to over the period (per week/month); the yearly total for per year. */
  expected: number | null;
  /** Delivered and required minutes split by service type. */
  byType: PeriodServiceByType[];
}

/** Service minutes over a reporting period (Progress Report), against the IEP's requirement. */
export function periodService(sessions: SessionData[], iep: StudentIep | undefined, from: Date, to: Date): PeriodService {
  const held = sessions.filter(s => !s.missed);
  const delivered = held.reduce((sum, s) => sum + (sessionMinutes(s) ?? 0), 0);
  const lines = serviceLines(iep);
  const per = lines.length > 0 ? lines[0].per : (iep?.servicePer ?? 'week');
  const required = lines.length > 0 && lines.every(l => l.per === per) ? lines.reduce((sum, l) => sum + l.minutes, 0) : null;
  // Whole days, first and last included.
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.max(1, Math.round((day(to) - day(from)) / 86_400_000) + 1);
  const periodsFor = (p: ServicePer) => p === 'week' ? days / 7 : p === 'month' ? days / 30.44 : 1;
  const periods = periodsFor(per);
  // Every type with a requirement line, plus every type that delivered minutes in the range.
  const deliveredByType = new Map<ServiceType, number>();
  for (const s of held) {
    const allocation = sessionServiceMinutes(s);
    for (const type of SERVICE_TYPES) {
      const value = allocation[type];
      if (value) deliveredByType.set(type, (deliveredByType.get(type) ?? 0) + value);
    }
  }
  const typesInOrder = SERVICE_TYPES.filter(t => lines.some(l => l.type === t) || deliveredByType.has(t));
  return {
    delivered,
    untimed: held.filter(s => sessionMinutes(s) === null).length,
    required,
    per,
    periods: Math.round(periods * 10) / 10,
    expected: required === null ? null : Math.round(required * periods),
    byType: typesInOrder.map(type => {
      const line = lines.find(l => l.type === type);
      return {
        type,
        label: SERVICE_TYPE_LABELS[type],
        delivered: deliveredByType.get(type) ?? 0,
        required: line ? line.minutes : null,
        expected: line ? Math.round(line.minutes * periodsFor(line.per)) : null,
      };
    }),
  };
}
