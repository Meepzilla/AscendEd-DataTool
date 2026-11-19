import { describe, expect, it } from 'vitest';
import { attendanceByDay, attendanceByMonth, attendanceRates, attendanceSummary, calendarWeeks, sessionDayKey } from '../attendance';
import { session } from './helpers';

const held = (date: string) => session({ date });
const missed = (date: string, reason: 'student-absent' | 'provider-absent' | 'no-school' | 'student-unavailable' | 'other') =>
  session({ date, missed: { reason } });

describe('attendance by month and day', () => {
  const sessions = [
    held('2026-09-03'), held('2026-09-10'), missed('2026-09-17', 'student-absent'),
    held('2026-10-01'), missed('2026-10-08', 'provider-absent'), missed('2026-10-08', 'no-school'), held('2026-10-08'),
  ];

  it('reads a session\'s local day from a date-only value or a stored instant', () => {
    expect(sessionDayKey('2026-10-08')).toBe('2026-10-08');
    // 6:30 PM in Los Angeles on Oct 8 is Oct 9 in UTC: the day is the local one.
    expect(sessionDayKey('2026-10-09T01:30:00.000Z')).toBe('2026-10-08');
    expect(sessionDayKey('not a date')).toBe('');
  });

  it('counts held and missed sessions in each month, oldest first', () => {
    const months = attendanceByMonth(sessions);
    expect(months.map(m => m.month)).toEqual(['2026-09', '2026-10']);
    expect(months[0]).toMatchObject({ held: 2, missed: 1, percentHeld: 67 });
    expect(months[0].byReason['student-absent']).toBe(1);
    expect(months[1]).toMatchObject({ held: 2, missed: 2, percentHeld: 50 });
    expect(months[1].byReason).toMatchObject({ 'provider-absent': 1, 'no-school': 1, 'student-absent': 0 });
    expect(attendanceByMonth([])).toEqual([]);
  });

  it('captures the minutes of held sessions for each month and each day', () => {
    // The factory's sessions run 09:00-09:30, so each held session is 30 minutes; missed sessions add none.
    const months = attendanceByMonth(sessions);
    expect(months[0].minutes).toBe(60);
    expect(months[1].minutes).toBe(60);
    const days = attendanceByDay(sessions);
    expect(days.get('2026-10-08')?.minutes).toBe(30);
    expect(days.get('2026-09-17')?.minutes).toBe(0);
  });

  it('sums a day\'s sessions and leaves an untimed held session out of the minutes', () => {
    const day = [
      session({ date: '2026-10-05', time: '09:00', endTime: '09:45' }),
      session({ date: '2026-10-05', time: '10:00', endTime: '10:30' }),
      session({ date: '2026-10-05', time: undefined, endTime: undefined }),
    ];
    expect(attendanceByDay(day).get('2026-10-05')).toEqual({ held: 3, minutes: 75, missed: [] });
    expect(attendanceByMonth(day)[0].minutes).toBe(75);
  });

  it('says what happened on each day, including a day with held and missed sessions', () => {
    const days = attendanceByDay(sessions);
    expect(days.get('2026-09-03')).toEqual({ held: 1, minutes: 30, missed: [] });
    expect(days.get('2026-09-17')).toEqual({ held: 0, minutes: 0, missed: ['student-absent'] });
    expect(days.get('2026-10-08')).toEqual({ held: 1, minutes: 30, missed: ['provider-absent', 'no-school'] });
    expect(days.has('2026-10-02')).toBe(false);
  });

  it('counts an unknown reason as other, and skips sessions without a readable date', () => {
    const odd = [session({ date: '2026-09-03', missed: { reason: 'snow-day' as never } }), session({ date: 'garbage' })];
    expect(attendanceByMonth(odd)).toHaveLength(1);
    expect(attendanceByMonth(odd)[0].byReason.other).toBe(1);
    expect(attendanceByDay(odd).get('2026-09-03')).toEqual({ held: 0, minutes: 0, missed: ['other'] });
    expect(attendanceSummary(odd).byReason).toEqual([{ reason: 'other', count: 1 }]);
  });

  it('gives the share held overall and the student\'s own attendance', () => {
    // 4 held, 3 missed: 1 student absent, 1 provider absent, 1 no school.
    const rates = attendanceRates(attendanceSummary(sessions));
    expect(rates.overall).toBe(57); // 4 of 7
    expect(rates.student).toBe(80); // 4 of 5: provider absent and no school aren't the student's
    expect(attendanceRates(attendanceSummary([]))).toEqual({ overall: null, student: null });
    expect(attendanceRates(attendanceSummary([missed('2026-09-01', 'no-school')]))).toEqual({ overall: 0, student: null });
  });
});

describe('calendar weeks', () => {
  it('lays a month out in weeks, Sunday first', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const weeks = calendarWeeks('2026-10');
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4]).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    expect(weeks.every(w => w.length === 7)).toBe(true);
  });

  it('handles February in a leap year and a month that needs six weeks', () => {
    expect(calendarWeeks('2028-02').flat().filter(Boolean)).toHaveLength(29);
    // August 2026 starts on a Saturday: 31 days over six weeks.
    expect(calendarWeeks('2026-08')).toHaveLength(6);
  });
});
