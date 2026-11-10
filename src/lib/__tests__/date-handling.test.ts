import { describe, expect, it } from 'vitest';
import { compareSessionsOldestFirst, formatDate, formatDateOnly, parseDateOnly, sessionInDateRange, sessionTimestamp } from '../helpers';

// Date-only values (YYYY-MM-DD) are stored days, not instants: in America/Los_Angeles, reading one as UTC
// midnight lands on the previous evening. These run under TZ=America/Los_Angeles (set in vitest.config.mts).

describe('formatDate', () => {
  it('shows a date-only string as the stored day, not the day before', () => {
    expect(formatDate('2026-08-01')).toBe('Aug 1, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('2026-11-07')).toBe('Nov 7, 2026');
  });
  it('leaves full timestamps and Date objects alone', () => {
    expect(formatDate('2026-10-05T09:00:00.000Z')).toBe('Oct 5, 2026');
    expect(formatDate(new Date(2026, 10, 7))).toBe('Nov 7, 2026');
  });
  it('still reports an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('Invalid Date');
  });
});

describe('formatDateOnly', () => {
  it('shows the stored day, not the day before', () => {
    expect(formatDateOnly('2026-08-01')).toBe('Aug 1, 2026');
    expect(formatDateOnly('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDateOnly('2026-10-05')).toBe('Oct 5, 2026');
  });
  it('leaves full timestamps alone', () => {
    expect(formatDateOnly('2026-10-05T09:00:00.000Z')).toBe('Oct 5, 2026');
  });
});

describe('parseDateOnly', () => {
  it('reads a stored day as that day at local midnight', () => {
    const d = parseDateOnly('2026-08-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 1]);
    expect(d.getHours()).toBe(0);
  });
});

describe('session ordering', () => {
  it('orders an Aug 1 session on Aug 1, not Jul 31', () => {
    const aug1 = { date: '2026-08-01', time: '09:00' };
    const jul31 = { date: '2026-07-31', time: '09:00' };
    expect(sessionTimestamp(aug1)).toBeGreaterThan(sessionTimestamp(jul31));
    expect(compareSessionsOldestFirst(aug1, jul31)).toBeGreaterThan(0);
    expect(new Date(sessionTimestamp(aug1)).getDate()).toBe(1);
  });
});

// The date-range filters on the Progress Report, Reports and Sessions pages.
describe('sessionInDateRange', () => {
  const nov9 = new Date(2026, 10, 9); // a date picker's choice: local midnight
  const nov10 = new Date(2026, 10, 10);
  const nov8 = new Date(2026, 10, 8);

  it('runs in a time zone west of UTC, where the date-only bug shows', () => {
    expect(new Date('2026-11-09').getDate()).toBe(8); // UTC midnight is the evening before here
  });
  it('puts an imported (date-only) session on its own day at both ends of a range', () => {
    expect(sessionInDateRange('2026-11-09', nov9, nov10)).toBe(true); // first day of the range
    expect(sessionInDateRange('2026-11-10', nov9, nov10)).toBe(true); // last day of the range
    expect(sessionInDateRange('2026-11-09', nov8, nov8)).toBe(false); // the day after a range ending 8 November
    expect(sessionInDateRange('2026-11-08', nov9, nov10)).toBe(false); // the day before
    expect(sessionInDateRange('2026-11-11', nov9, nov10)).toBe(false); // the day after
  });
  it('includes the whole of the last day for sessions saved with a time', () => {
    expect(sessionInDateRange(new Date(2026, 10, 10, 23, 30).toISOString(), nov9, nov10)).toBe(true);
    expect(sessionInDateRange(new Date(2026, 10, 11, 0, 0).toISOString(), nov9, nov10)).toBe(false);
    expect(sessionInDateRange(new Date(2026, 10, 8, 23, 59).toISOString(), nov9, nov10)).toBe(false);
  });
  it('counts the start from the beginning of its day even if the picked date has a time', () => {
    expect(sessionInDateRange('2026-11-09', new Date(2026, 10, 9, 15, 0), nov10)).toBe(true);
  });
  it('leaves an open end open', () => {
    expect(sessionInDateRange('2026-01-01', null, nov10)).toBe(true);
    expect(sessionInDateRange('2030-01-01', nov9, undefined)).toBe(true);
    expect(sessionInDateRange('2026-11-09')).toBe(true);
  });
  it('keeps a session with an unreadable date out of any range, but not when no range is set', () => {
    expect(sessionInDateRange('not-a-date', nov9, nov10)).toBe(false);
    expect(sessionInDateRange('not-a-date')).toBe(true);
  });
});
