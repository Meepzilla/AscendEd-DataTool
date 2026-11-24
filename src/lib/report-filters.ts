import { schoolYearStart } from './school-year';

// Reports' filters, remembered on this device: the date range (a quick range such as "Last 9 weeks", worked out
// again from today each time, or custom dates) and the goal chosen for each student. Only ids and dates are
// kept, never names. Anything unreadable falls back to no filter.

export type QuickRange = 'last-30' | 'last-9-weeks' | 'school-year' | 'all';

export const QUICK_RANGE_LABELS: Record<QuickRange, string> = {
  'last-30': 'Last 30 days',
  'last-9-weeks': 'Last 9 weeks',
  'school-year': 'School year',
  all: 'All',
};
export const QUICK_RANGES = Object.keys(QUICK_RANGE_LABELS) as QuickRange[];

export interface DateSpan { from?: Date; to?: Date }

/** What the date filter is set to: a quick range, or custom dates (YYYY-MM-DD, `to` optional). */
export type RangeChoice = { quick: QuickRange } | { from: string; to?: string };

const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
const daysAgo = (n: number, now: Date) => { const d = startOfDay(now); d.setDate(d.getDate() - n); return d; };
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromDayKey = (key: string) => new Date(`${key}T00:00`);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The dates a quick range covers today; undefined for "All" (no date filter). */
export function quickRangeDates(range: QuickRange, now = new Date()): DateSpan | undefined {
  switch (range) {
    case 'last-30': return { from: daysAgo(30, now), to: now };
    case 'last-9-weeks': return { from: daysAgo(63, now), to: now };
    case 'school-year': return { from: schoolYearStart(now), to: now };
    default: return undefined;
  }
}

/** The dates a remembered choice covers today. */
export function rangeChoiceDates(choice: RangeChoice | null, now = new Date()): DateSpan | undefined {
  if (!choice) return undefined;
  if ('quick' in choice) return quickRangeDates(choice.quick, now);
  return { from: fromDayKey(choice.from), to: choice.to ? fromDayKey(choice.to) : undefined };
}

/** The choice to remember for custom dates picked in the calendar (null when no start date is set). */
export function customRangeChoice(span: DateSpan | undefined): RangeChoice | null {
  if (!span?.from || Number.isNaN(span.from.getTime())) return null;
  return { from: dayKey(span.from), ...(span.to && !Number.isNaN(span.to.getTime()) ? { to: dayKey(span.to) } : {}) };
}

const RANGE_KEY = 'ascended_report_range';
const GOAL_KEY = 'ascended_report_goals';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; the filter still works for this visit.
  }
}

/** The remembered date filter, or null (no filter) when none is kept or it can't be read. */
export function readRangeChoice(): RangeChoice | null {
  const stored = read<Record<string, unknown>>(RANGE_KEY);
  if (!stored || typeof stored !== 'object') return null;
  if (typeof stored.quick === 'string') return QUICK_RANGES.includes(stored.quick as QuickRange) && stored.quick !== 'all' ? { quick: stored.quick as QuickRange } : null;
  if (typeof stored.from === 'string' && DAY.test(stored.from)) {
    return { from: stored.from, ...(typeof stored.to === 'string' && DAY.test(stored.to) ? { to: stored.to } : {}) };
  }
  return null;
}

export function rememberRangeChoice(choice: RangeChoice | null): void {
  // "All" is the same as no filter.
  write(RANGE_KEY, choice && 'quick' in choice && choice.quick === 'all' ? null : choice);
}

/** The goal last chosen for the student, if it is still one of `goalIds`. */
export function readGoalChoice(studentId: string, goalIds: string[]): string | undefined {
  const stored = read<Record<string, unknown>>(GOAL_KEY);
  const goalId = stored && typeof stored === 'object' ? stored[studentId] : undefined;
  return typeof goalId === 'string' && goalIds.includes(goalId) ? goalId : undefined;
}

export function rememberGoalChoice(studentId: string, goalId: string | undefined): void {
  const stored = read<Record<string, unknown>>(GOAL_KEY);
  const next: Record<string, unknown> = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
  if (goalId) next[studentId] = goalId; else delete next[studentId];
  write(GOAL_KEY, Object.keys(next).length ? next : null);
}

export type ReportTab = 'progress' | 'prompts' | 'trials' | 'attendance';
export const REPORT_TABS: ReportTab[] = ['progress', 'prompts', 'trials', 'attendance'];
export const REPORT_TAB_LABELS: Record<ReportTab, string> = {
  progress: 'Goal Progress',
  prompts: 'Prompting & Support',
  trials: 'Trials & Outcomes',
  attendance: 'Attendance',
};
export const REPORT_TAB_DESCRIPTIONS: Record<ReportTab, string> = {
  progress: 'Is the student meeting each goal, and how is each skill trending toward its target?',
  prompts: 'How much support did the student need, and are prompts fading toward independence?',
  trials: 'How did correct, approximate, and incorrect responses and within-session trial sequences break down?',
  attendance: 'How consistently were sessions held in this period, and why were sessions missed?',
};

export type TimeGrouping = 'session' | 'week' | 'month';
export const TIME_GROUPINGS: TimeGrouping[] = ['session', 'week', 'month'];
export const TIME_GROUPING_LABELS: Record<TimeGrouping, string> = {
  session: 'Per session',
  week: 'By week',
  month: 'By month',
};

export type GoalChartView = 'line' | 'bar' | 'table';
export const GOAL_CHART_VIEWS: GoalChartView[] = ['line', 'bar', 'table'];
export const GOAL_CHART_VIEW_LABELS: Record<GoalChartView, string> = {
  line: 'Line',
  bar: 'Bars',
  table: 'Table',
};

const TAB_KEY = 'ascended_report_tab';
const GROUPING_KEY = 'ascended_report_grouping';
const GOAL_VIEW_KEY = 'ascended_report_goal_view';

export function readReportTab(): ReportTab {
  const stored = read<unknown>(TAB_KEY);
  return typeof stored === 'string' && REPORT_TABS.includes(stored as ReportTab) ? (stored as ReportTab) : 'progress';
}

export function rememberReportTab(tab: ReportTab): void {
  write(TAB_KEY, tab === 'progress' ? null : tab);
}

export function readTimeGrouping(): TimeGrouping {
  const stored = read<unknown>(GROUPING_KEY);
  return typeof stored === 'string' && TIME_GROUPINGS.includes(stored as TimeGrouping) ? (stored as TimeGrouping) : 'session';
}

export function rememberTimeGrouping(grouping: TimeGrouping): void {
  write(GROUPING_KEY, grouping === 'session' ? null : grouping);
}

export function readGoalChartView(): GoalChartView {
  const stored = read<unknown>(GOAL_VIEW_KEY);
  return typeof stored === 'string' && GOAL_CHART_VIEWS.includes(stored as GoalChartView) ? (stored as GoalChartView) : 'line';
}

export function rememberGoalChartView(view: GoalChartView): void {
  write(GOAL_VIEW_KEY, view === 'line' ? null : view);
}

