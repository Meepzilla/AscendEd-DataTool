import { describe, expect, it } from 'vitest';
import { compareSessionsOldestFirst, parseDateOnly, sessionTimestamp } from '../helpers';

// compareSessionsOldestFirst remembers each session's sort keys (audit P3). The order must be exactly what the
// comparator gave before, which this checks against a copy of the old one.
const oldCompare = (a: { date: string; time?: string }, b: { date: string; time?: string }) => {
  const at = (s: { date: string; time?: string }) => { const t = sessionTimestamp(s); return Number.isNaN(t) ? Infinity : t; };
  const stored = (s: { date: string }) => { const t = parseDateOnly(s.date).getTime(); return Number.isNaN(t) ? Infinity : t; };
  const byTime = at(a) === at(b) ? 0 : at(a) - at(b);
  return byTime || (stored(a) === stored(b) ? 0 : stored(a) - stored(b));
};

describe('session order with remembered sort keys', () => {
  it('sorts exactly as before, including unreadable dates, missing times and ties', () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const dates = ['2026-11-04', '2026-11-05', '2026-02-30', 'garbage', '2026-11-04T17:00:00.000Z', '2026-10-31', ''];
    const times = ['09:00', '13:30', '', undefined, 'bad', '9:05'];
    const sessions = Array.from({ length: 600 }, (_, i) => ({ id: i, date: dates[Math.floor(rnd() * dates.length)], time: times[Math.floor(rnd() * times.length)] }));
    const expected = [...sessions].sort(oldCompare).map(s => s.id);
    expect([...sessions].sort(compareSessionsOldestFirst).map(s => s.id)).toEqual(expected);
    // Again, with every key already remembered.
    expect([...sessions].sort(compareSessionsOldestFirst).map(s => s.id)).toEqual(expected);
    expect([...sessions].sort((a, b) => compareSessionsOldestFirst(b, a)).map(s => s.id)).toEqual([...sessions].sort((a, b) => oldCompare(b, a)).map(s => s.id));
  });

  it("works the keys out again when a session's date or time is changed in place", () => {
    const a = { date: '2026-11-04', time: '09:00' };
    const b = { date: '2026-11-05', time: '09:00' };
    expect(compareSessionsOldestFirst(a, b)).toBeLessThan(0);
    a.date = '2026-11-06';
    expect(compareSessionsOldestFirst(a, b)).toBeGreaterThan(0);
    b.time = '23:00';
    b.date = '2026-11-06';
    expect(compareSessionsOldestFirst(a, b)).toBeLessThan(0);
  });
});
