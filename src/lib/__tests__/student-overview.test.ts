import { describe, expect, it } from 'vitest';
import { formatMinutes, periodService, serviceLines, sessionMinutes, sessionServiceMinutes, servicePeriods, studentOverview } from '../student-overview';
import { session } from './helpers';

describe('formatMinutes', () => {
  it('formats whole minutes as before', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(135)).toBe('2 h 15 min');
  });
  it('never shows 60 minutes in the minutes place', () => {
    expect(formatMinutes(119.6)).toBe('2 h');
    expect(formatMinutes(59.5)).toBe('1 h');
    expect(formatMinutes(59.4)).toBe('59 min');
    expect(formatMinutes(89.6)).toBe('1 h 30 min');
  });
});

describe('sessionMinutes', () => {
  it('is the minutes between start and end', () => {
    expect(sessionMinutes({ time: '09:00', endTime: '09:45' })).toBe(45);
  });
  it('is null without both times or for a span that makes no sense', () => {
    expect(sessionMinutes({ time: '09:00' })).toBeNull();
    expect(sessionMinutes({ time: '10:00', endTime: '09:00' })).toBeNull();
    expect(sessionMinutes({ time: '00:00', endTime: '23:00' })).toBeNull();
  });
  it('rejects times that are not real clock times', () => {
    expect(sessionMinutes({ time: '9:99', endTime: '10:00' })).toBeNull();
    expect(sessionMinutes({ time: '25:00', endTime: '26:00' })).toBeNull();
    expect(sessionMinutes({ time: '09:00', endTime: '09:60' })).toBeNull();
    expect(sessionMinutes({ time: '09:00', endTime: '09:30:00' })).toBeNull();
    expect(sessionMinutes({ time: '09:00', endTime: '09:30' })).toBe(30);
    expect(sessionMinutes({ time: '9:00', endTime: '9:30' })).toBe(30);
  });
  it('is null for a span over 600 minutes, not 0', () => {
    expect(sessionMinutes({ time: '00:00', endTime: '10:01' })).toBeNull();
    expect(sessionMinutes({ time: '00:00', endTime: '10:00' })).toBe(600);
  });
});

describe('servicePeriods', () => {
  it('uses Monday-to-Sunday weeks', () => {
    const { current, previous } = servicePeriods('week', new Date(2026, 9, 29)); // Thursday
    expect(current.start).toEqual(new Date(2026, 9, 26));
    expect(current.end).toEqual(new Date(2026, 10, 2));
    expect(previous.start).toEqual(new Date(2026, 9, 19));
  });
  it('uses calendar months', () => {
    const { current, previous } = servicePeriods('month', new Date(2026, 9, 29));
    expect(current.start).toEqual(new Date(2026, 9, 1));
    expect(previous.start).toEqual(new Date(2026, 8, 1));
  });
});

describe('studentOverview', () => {
  it('adds up this and last week\'s minutes and leaves out missed sessions', () => {
    const now = new Date(2026, 9, 29, 12);
    const sessions = [
      session({ date: new Date(2026, 9, 27, 9).toISOString(), time: '09:00', endTime: '09:30' }),
      session({ date: new Date(2026, 9, 28, 9).toISOString(), time: '09:00', endTime: '09:20' }),
      session({ date: new Date(2026, 9, 21, 9).toISOString(), time: '09:00', endTime: '09:15' }),
      session({ date: new Date(2026, 9, 26, 9).toISOString(), time: '09:00', endTime: '10:00', missed: { reason: 'student-absent' } }),
    ];
    const overview = studentOverview(sessions, { serviceMinutes: 60, servicePer: 'week' }, now);
    expect(overview.service).toMatchObject({ required: 60, thisPeriod: 50, lastPeriod: 15 });
    expect(overview.attendance).toMatchObject({ held: 3, missed: 1 });
  });

  it('counts a session on Aug 1 in the school year starting Aug 1 (America/Los_Angeles)', () => {
    // A stored YYYY-MM-DD reads as UTC midnight, which is Jul 31 in Los Angeles; the session must still
    // count on the first day of its school year, week and month.
    const now = new Date(2026, 8, 15, 12);
    const sessions = [
      session({ date: '2026-08-01', time: '09:00', endTime: '09:30' }),
      session({ date: '2026-08-01', time: '10:00', endTime: '10:30', missed: { reason: 'student-absent' } }),
    ];
    const overview = studentOverview(sessions, { serviceMinutes: 60, servicePer: 'week' }, now);
    expect(overview.service.schoolYear).toBe(30);
    expect(overview.service.untimed).toBe(0);
    expect(overview.attendance).toMatchObject({ held: 1, missed: 1 });
    expect(overview.lastSessionDate).toBe('2026-08-01');
  });

  it('counts an over-long or end-before-start session as untimed, not as 0 minutes delivered', () => {
    const now = new Date(2026, 9, 29, 12);
    const sessions = [
      session({ date: new Date(2026, 9, 27, 9).toISOString(), time: '00:00', endTime: '23:00' }),
      session({ date: new Date(2026, 9, 27, 9).toISOString(), time: '09:00', endTime: undefined }),
    ];
    const overview = studentOverview(sessions, { serviceMinutes: 60, servicePer: 'week' }, now);
    expect(overview.service).toMatchObject({ thisPeriod: 0, untimed: 2 });
  });
});

describe('serviceLines', () => {
  it('falls back to the legacy single line as Related Service', () => {
    expect(serviceLines({ serviceMinutes: 60, servicePer: 'month' })).toEqual([{ type: 'related', minutes: 60, per: 'month' }]);
    expect(serviceLines({ serviceMinutes: 45 })).toEqual([{ type: 'related', minutes: 45, per: 'week' }]);
  });
  it('returns nothing without any requirement', () => {
    expect(serviceLines(undefined)).toEqual([]);
    expect(serviceLines({})).toEqual([]);
    expect(serviceLines({ serviceMinutes: 0 })).toEqual([]);
  });
  it('uses explicit lines and drops duplicates and empty lines', () => {
    expect(serviceLines({
      serviceMinutes: 90,
      services: [
        { type: 'related', minutes: 60, per: 'week' },
        { type: 'aac', minutes: 30, per: 'week' },
        { type: 'related', minutes: 15, per: 'week' },
        { type: 'aac', minutes: 0, per: 'week' },
      ],
    })).toEqual([
      { type: 'related', minutes: 60, per: 'week' },
      { type: 'aac', minutes: 30, per: 'week' },
    ]);
  });
});

describe('sessionServiceMinutes', () => {
  it('counts a legacy session in full as Related Service', () => {
    expect(sessionServiceMinutes(session({ time: '09:00', endTime: '09:30' }))).toEqual({ related: 30 });
  });
  it('uses an explicit split as recorded', () => {
    expect(sessionServiceMinutes(session({ time: '09:00', endTime: '09:30', serviceMinutes: { related: 20, aac: 10 } }))).toEqual({ related: 20, aac: 10 });
  });
  it('sanitizes a split: unknown keys, non-numbers and non-positive values drop out', () => {
    const dirty = session({ time: '09:00', endTime: '09:30', serviceMinutes: { aac: 12.6, related: -5 } as never });
    expect(sessionServiceMinutes(dirty)).toEqual({ aac: 13 });
  });
  it('falls back to the timed total when a split adds up to nothing', () => {
    expect(sessionServiceMinutes(session({ time: '09:00', endTime: '09:30', serviceMinutes: {} }))).toEqual({ related: 30 });
  });
  it('gives nothing for a missed session', () => {
    expect(sessionServiceMinutes(session({ missed: { reason: 'student-absent' }, serviceMinutes: { aac: 10 } }))).toEqual({});
  });
  it('gives nothing for an untimed session without a split', () => {
    expect(sessionServiceMinutes(session({ time: '09:00', endTime: undefined }))).toEqual({});
  });
});

describe('studentOverview service lines', () => {
  it('breaks delivered minutes down by type, including a split session', () => {
    const now = new Date(2026, 9, 29, 12);
    const sessions = [
      session({ date: new Date(2026, 9, 27, 9).toISOString(), time: '09:00', endTime: '09:30', serviceMinutes: { related: 20, aac: 10 } }),
      session({ date: new Date(2026, 9, 28, 9).toISOString(), time: '10:00', endTime: '10:30' }),
    ];
    const overview = studentOverview(sessions, {
      services: [
        { type: 'related', minutes: 60, per: 'week' },
        { type: 'aac', minutes: 30, per: 'week' },
      ],
    }, now);
    expect(overview.service).toMatchObject({ required: 90, thisPeriod: 60 });
    expect(overview.lines).toEqual([
      { type: 'related', label: 'Related Service', required: 60, per: 'week', thisPeriod: 50, lastPeriod: 0, schoolYear: 50 },
      { type: 'aac', label: 'AAC', required: 30, per: 'week', thisPeriod: 10, lastPeriod: 0, schoolYear: 10 },
    ]);
  });
  it('sets the total requirement to null when lines use mixed periods', () => {
    const overview = studentOverview([], {
      services: [
        { type: 'related', minutes: 60, per: 'week' },
        { type: 'aac', minutes: 120, per: 'month' },
      ],
    }, new Date(2026, 9, 29, 12));
    expect(overview.service.required).toBeNull();
    expect(overview.lines.map(l => l.required)).toEqual([60, 120]);
  });
});

describe('periodService byType', () => {
  it('reports delivered, required and expected per type', () => {
    const from = new Date(2026, 9, 5);
    const to = new Date(2026, 9, 18); // 14 days = 2 weeks
    const sessions = [
      session({ date: '2026-10-06', time: '09:00', endTime: '09:30', serviceMinutes: { related: 20, aac: 10 } }),
      session({ date: '2026-10-07', time: '10:00', endTime: '10:45' }),
    ];
    const result = periodService(sessions, {
      services: [
        { type: 'related', minutes: 60, per: 'week' },
        { type: 'aac', minutes: 30, per: 'week' },
      ],
    }, from, to);
    expect(result).toMatchObject({ delivered: 75, required: 90, expected: 180 });
    expect(result.byType).toEqual([
      { type: 'related', label: 'Related Service', delivered: 65, required: 60, expected: 120 },
      { type: 'aac', label: 'AAC', delivered: 10, required: 30, expected: 60 },
    ]);
  });
  it('includes a type that delivered minutes without a requirement line', () => {
    const result = periodService(
      [session({ date: '2026-10-06', time: '09:00', endTime: '09:30', serviceMinutes: { aac: 30 } })],
      { serviceMinutes: 60, servicePer: 'week' },
      new Date(2026, 9, 5), new Date(2026, 9, 11),
    );
    expect(result.byType).toEqual([
      { type: 'related', label: 'Related Service', delivered: 0, required: 60, expected: 60 },
      { type: 'aac', label: 'AAC', delivered: 30, required: null, expected: null },
    ]);
  });
});
