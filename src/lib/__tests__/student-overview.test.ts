import { describe, expect, it } from 'vitest';
import { sessionMinutes, servicePeriods, studentOverview } from '../student-overview';
import { session } from './helpers';

describe('sessionMinutes', () => {
  it('is the minutes between start and end', () => {
    expect(sessionMinutes({ time: '09:00', endTime: '09:45' })).toBe(45);
  });
  it('is 0 without both times or for a span that makes no sense', () => {
    expect(sessionMinutes({ time: '09:00' })).toBe(0);
    expect(sessionMinutes({ time: '10:00', endTime: '09:00' })).toBe(0);
    expect(sessionMinutes({ time: '00:00', endTime: '23:00' })).toBe(0);
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
});
