import type { SessionData } from './types';
import { ABC_REPLACEMENT_BEHAVIOR, summarizeIntervals, type AbcIncident } from './goal-constants';

// When behavior happened, for time-of-day, day-of-week and within-session patterns.
//
// Data Entry records a clock time for each frequency tap (occurrenceTimes), each duration episode's start
// (episodeStarts), each latency trial's cue (trialTimes), the start of interval recording (startedAt), and
// each ABC incident (time). Sessions saved before times were recorded, and anything entered by hand, fall
// back to the session's start time and are marked as not exact.

export interface BehaviorEvent {
  at: Date;
  /** False when only the session's start time is known. */
  exact: boolean;
  /** Occurrences (frequency, ABC, interval), minutes (duration) or seconds to respond (latency). */
  amount: number;
  detail?: string;
}

export type TimingMeasure = 'count' | 'minutes' | 'seconds';

export function timingMeasure(type: string): TimingMeasure {
  if (type === 'BEHAVIOR_DURATION') return 'minutes';
  if (type === 'BEHAVIOR_LATENCY') return 'seconds';
  return 'count';
}

export const TIMING_MEASURE_LABELS: Record<TimingMeasure, { total: string; unit: string }> = {
  count: { total: 'Occurrences', unit: '' },
  minutes: { total: 'Minutes of behavior', unit: ' min' },
  seconds: { total: 'Average seconds to respond', unit: ' s' },
};

/** The session's start as a date and time (its date with the start time, if one was entered). */
export function sessionStart(session: Pick<SessionData, 'date' | 'time'>): Date | null {
  const day = new Date(session.date);
  if (Number.isNaN(day.getTime())) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(session.time || '');
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (match) start.setHours(Number(match[1]), Number(match[2]));
  return start;
}

const parseDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const timeOf = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** The recorded occurrences of a behavior goal in one session, with when each happened. */
export function behaviorEvents(type: string, data: Record<string, any> = {}, start: Date | null): BehaviorEvent[] {
  const events: BehaviorEvent[] = [];
  // A time on another day than the session's was recorded while editing the session later, so it isn't
  // when the behavior happened.
  const validDate = (value: unknown): Date | null => {
    const at = parseDate(value);
    return at && (!start || at.toDateString() === start.toDateString()) ? at : null;
  };
  const fallback = (amount: number, detail?: string) => {
    if (start && amount > 0) events.push({ at: start, exact: false, amount, detail });
  };

  if (type === 'BEHAVIOR_FREQUENCY') {
    const count = Math.max(0, Math.round(Number(data.count) || 0));
    const times = (Array.isArray(data.occurrenceTimes) ? data.occurrenceTimes : []).slice(0, count).map(validDate);
    times.forEach(at => (at ? events.push({ at, exact: true, amount: 1 }) : fallback(1)));
    fallback(count - times.length);
  } else if (type === 'BEHAVIOR_DURATION') {
    const seconds: number[] = Array.isArray(data.episodeSeconds) ? data.episodeSeconds.map(Number) : [];
    const starts: unknown[] = Array.isArray(data.episodeStarts) ? data.episodeStarts : [];
    seconds.forEach((s, i) => {
      if (!(s > 0)) return;
      const at = validDate(starts[i]);
      const detail = `${Math.round(s / 6) / 10} min episode`;
      if (at) events.push({ at, exact: true, amount: s / 60, detail });
      else fallback(s / 60, detail);
    });
  } else if (type === 'BEHAVIOR_ABC') {
    const incidents: AbcIncident[] = Array.isArray(data.incidents) ? data.incidents : [];
    incidents.filter(i => i.behavior !== ABC_REPLACEMENT_BEHAVIOR).forEach(incident => {
      const at = validDate(incident.time);
      const detail = [incident.antecedent || '?', incident.behavior, incident.consequence || '?'].join(' → ');
      if (at) events.push({ at, exact: true, amount: 1, detail });
      else fallback(1, detail);
    });
  } else if (type === 'BEHAVIOR_INTERVAL') {
    const summary = summarizeIntervals(data);
    const startedAt = validDate(data.startedAt);
    summary.intervals.forEach((occurred, i) => {
      if (occurred !== true) return;
      const detail = `Interval ${i + 1}`;
      if (startedAt) events.push({ at: new Date(startedAt.getTime() + i * summary.intervalSeconds * 1000), exact: true, amount: 1, detail });
      else fallback(1, detail);
    });
  } else if (type === 'BEHAVIOR_LATENCY') {
    const latencies: unknown[] = Array.isArray(data.latencies) ? data.latencies : [];
    const times: unknown[] = Array.isArray(data.trialTimes) ? data.trialTimes : [];
    latencies.forEach((value, i) => {
      if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return;
      const at = validDate(times[i]);
      const detail = `Trial ${i + 1}: ${Number(value)} s`;
      if (at) events.push({ at, exact: true, amount: Number(value), detail });
      else fallback(Number(value), detail);
    });
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface TimingBucket { name: string; value: number; sessions: number }

export interface TimePatterns {
  measure: TimingMeasure;
  eventCount: number;
  /** Share of the events with an exact time (the rest use the session's start time). */
  exactShare: number;
  /** Total per hour of the day (average for latency), with the number of sessions that ran in that hour. */
  byHour: TimingBucket[];
  /** Average per session on each weekday (average latency for latency goals). */
  byWeekday: TimingBucket[];
  /** Total per 10 minutes since the session started (exact times only). */
  byMinuteIntoSession: TimingBucket[];
  peakHour: TimingBucket | null;
  peakWeekday: TimingBucket | null;
  log: { at: Date; exact: boolean; text: string }[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES: Record<string, string> = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
const roundTenth = (n: number) => Math.round(n * 10) / 10;

/** Time-of-day, day-of-week and within-session patterns of a behavior goal over the given sessions. */
export function timePatterns(type: string, sessions: { session: Pick<SessionData, 'date' | 'time' | 'endTime'>; data: Record<string, any> }[]): TimePatterns {
  const measure = timingMeasure(type);
  const average = measure === 'seconds';
  const all: (BehaviorEvent & { start: Date | null })[] = [];
  const sessionHours = new Map<number, number>();
  const sessionDays = new Map<number, number>();

  sessions.forEach(({ session, data }) => {
    const start = sessionStart(session);
    behaviorEvents(type, data, start).forEach(e => all.push({ ...e, start }));
    if (!start) return;
    sessionDays.set(start.getDay(), (sessionDays.get(start.getDay()) || 0) + 1);
    // The hours the session ran (to its end time when one was entered).
    const end = sessionStart({ date: session.date, time: session.endTime || '' });
    const lastHour = end && session.endTime && end > start ? end.getHours() : start.getHours();
    for (let h = start.getHours(); h <= lastHour; h++) sessionHours.set(h, (sessionHours.get(h) || 0) + 1);
  });

  const combine = (groups: Map<number, number[]>) => (key: number) => {
    const values = groups.get(key) || [];
    if (values.length === 0) return 0;
    const total = values.reduce((a, b) => a + b, 0);
    return roundTenth(average ? total / values.length : total);
  };

  // Time of day.
  const hourGroups = new Map<number, number[]>();
  all.forEach(e => hourGroups.set(e.at.getHours(), [...(hourGroups.get(e.at.getHours()) || []), e.amount]));
  const hours = [...hourGroups.keys(), ...sessionHours.keys()];
  const byHour: TimingBucket[] = [];
  if (hours.length) {
    const hourValue = combine(hourGroups);
    for (let h = Math.min(...hours); h <= Math.max(...hours); h++) byHour.push({ name: hourLabel(h), value: hourValue(h), sessions: sessionHours.get(h) || 0 });
  }

  // Day of week: per session on that day, so a day with more sessions doesn't look worse.
  const dayGroups = new Map<number, number[]>();
  all.forEach(e => dayGroups.set(e.at.getDay(), [...(dayGroups.get(e.at.getDay()) || []), e.amount]));
  const byWeekday: TimingBucket[] = [1, 2, 3, 4, 5, 6, 0]
    .filter(d => sessionDays.has(d) || dayGroups.has(d) || (d >= 1 && d <= 5))
    .map(d => {
      const values = dayGroups.get(d) || [];
      const total = values.reduce((a, b) => a + b, 0);
      const sessionsThatDay = sessionDays.get(d) || 0;
      const value = average ? (values.length ? total / values.length : 0) : sessionsThatDay ? total / sessionsThatDay : total;
      return { name: WEEKDAYS[d], value: roundTenth(value), sessions: sessionsThatDay };
    });

  // Minutes into the session, in 10-minute blocks (only events with an exact time).
  const minuteGroups = new Map<number, number[]>();
  all.forEach(e => {
    if (!e.exact || !e.start) return;
    const minutes = (e.at.getTime() - e.start.getTime()) / 60000;
    if (minutes < 0 || minutes > 240) return;
    const block = Math.floor(minutes / 10);
    minuteGroups.set(block, [...(minuteGroups.get(block) || []), e.amount]);
  });
  const byMinuteIntoSession: TimingBucket[] = [];
  if (minuteGroups.size) {
    const blockValue = combine(minuteGroups);
    for (let b = 0; b <= Math.max(...minuteGroups.keys()); b++) {
      byMinuteIntoSession.push({ name: `${b * 10}-${b * 10 + 10} min`, value: blockValue(b), sessions: 0 });
    }
  }

  const peak = (buckets: TimingBucket[]) => {
    const withData = buckets.filter(b => b.value > 0);
    if (withData.length === 0) return null;
    // For latency the "peak" is the slowest time; for the others the most behavior. A tie has no peak.
    const best = withData.reduce((top, b) => (b.value > top.value ? b : top));
    return withData.filter(b => b.value === best.value).length > 1 ? null : best;
  };

  const exactCount = all.filter(e => e.exact).length;
  return {
    measure,
    eventCount: all.length,
    exactShare: all.length ? exactCount / all.length : 0,
    byHour,
    byWeekday,
    byMinuteIntoSession,
    peakHour: peak(byHour),
    peakWeekday: peak(byWeekday),
    log: all
      .slice()
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map(e => ({
        at: e.at,
        exact: e.exact,
        text: [
          measure === 'count' && e.amount !== 1 ? `${e.amount} occurrences` : null,
          e.detail,
        ].filter(Boolean).join(' · ') || 'Occurrence',
      })),
  };
}

export { timeOf as formatClockTime };
