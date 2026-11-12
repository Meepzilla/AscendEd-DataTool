import { describe, expect, it } from 'vitest';
import { defaultSessionTimes, previousSessionTimes } from '../session-time';
import { sessionMinutes } from '../student-overview';

describe('defaultSessionTimes', () => {
  it('starts now and ends 30 minutes later', () => {
    expect(defaultSessionTimes(new Date(2026, 9, 5, 9, 0))).toEqual({ start: '09:00', end: '09:30' });
  });
  it('clamps the end to 23:59 instead of rolling past midnight', () => {
    const times = defaultSessionTimes(new Date(2026, 9, 5, 23, 50));
    expect(times).toEqual({ start: '23:50', end: '23:59' });
    // The end is after the start, so the span counts instead of reading as untimed.
    expect(sessionMinutes({ time: times.start, endTime: times.end })).toBe(9);
    expect(defaultSessionTimes(new Date(2026, 9, 5, 23, 30))).toEqual({ start: '23:30', end: '23:59' });
    expect(defaultSessionTimes(new Date(2026, 9, 5, 23, 29))).toEqual({ start: '23:29', end: '23:59' });
  });
});

describe('previousSessionTimes', () => {
  it('ends now and starts 30 minutes earlier', () => {
    const times = previousSessionTimes(new Date(2026, 9, 5, 10, 15));
    expect(times).toEqual({ start: '09:45', end: '10:15' });
    expect(sessionMinutes({ time: times.start, endTime: times.end })).toBe(30);
  });
  it('clamps the start to 00:00 instead of rolling back to the previous evening', () => {
    const times = previousSessionTimes(new Date(2026, 9, 5, 0, 15));
    expect(times).toEqual({ start: '00:00', end: '00:15' });
    // The start is before the end, so the span counts instead of reading as untimed.
    expect(sessionMinutes({ time: times.start, endTime: times.end })).toBe(15);
    expect(previousSessionTimes(new Date(2026, 9, 5, 0, 30))).toEqual({ start: '00:00', end: '00:30' });
  });
});
