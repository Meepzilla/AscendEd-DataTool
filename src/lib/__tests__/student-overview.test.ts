import { describe, expect, it } from 'vitest';
import { sessionMinutes, servicePeriods, studentOverview } from '../student-overview';
import { session } from './helpers';

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
