import { describe, expect, it } from 'vitest';
import { compareSessionsOldestFirst, formatDateOnly, parseDateOnly, sessionTimestamp } from '../helpers';

// Date-only values (YYYY-MM-DD) are stored days, not instants: in America/Los_Angeles, reading one as UTC
// midnight lands on the previous evening. These run under TZ=America/Los_Angeles (see the test command).

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
