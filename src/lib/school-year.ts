import { formatDate } from './helpers';

// The school year's first and last day (Settings → Interface → School Year), as month and day so it repeats each
// year. Used for school-year attendance and service minutes, and the Progress Report's "School year to date".
// Saved on this device only; August 1 to July 31 when not set.

export const SCHOOL_YEAR_KEY = 'ascended_school_year';
export const SCHOOL_YEAR_EVENT = 'ascended-school-year';

export interface SchoolYearSetting {
  /** First day, "MM-DD". */
  start: string;
  /** Last day, "MM-DD". */
  end: string;
}

export const DEFAULT_SCHOOL_YEAR: SchoolYearSetting = { start: '08-01', end: '07-31' };

const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function getSchoolYearSetting(): SchoolYearSetting {
  try {
    const saved = JSON.parse(localStorage.getItem(SCHOOL_YEAR_KEY) || 'null');
    if (saved && MONTH_DAY.test(saved.start) && MONTH_DAY.test(saved.end)) return saved;
  } catch { /* the default */ }
  return DEFAULT_SCHOOL_YEAR;
}

export function setSchoolYearSetting(setting: SchoolYearSetting) {
  try { localStorage.setItem(SCHOOL_YEAR_KEY, JSON.stringify(setting)); } catch { /* this visit only */ }
  window.dispatchEvent(new Event(SCHOOL_YEAR_EVENT));
}

function onDay(year: number, monthDay: string): Date {
  const [m, d] = monthDay.split('-').map(Number);
  return new Date(year, m - 1, d);
}

/**
 * The school year containing `now`: from its first day to the day after its last day. Before this year's first
 * day it is the year that started last year; in the summer gap after the last day it is still that year (until
 * the next one starts).
 */
export function schoolYearRange(now = new Date(), setting = getSchoolYearSetting()): { start: Date; end: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYear = today >= onDay(today.getFullYear(), setting.start) ? today.getFullYear() : today.getFullYear() - 1;
  const start = onDay(startYear, setting.start);
  let last = onDay(startYear, setting.end);
  if (last < start) last = onDay(startYear + 1, setting.end);
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  return { start, end };
}

export function schoolYearStart(now = new Date()): Date {
  return schoolYearRange(now).start;
}

/** e.g. "Aug 26, 2026 – Jun 12, 2027". */
export function schoolYearLabel(now = new Date()): string {
  const { start, end } = schoolYearRange(now);
  return `${formatDate(start)} – ${formatDate(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1))}`;
}
