import { describe, expect, it } from 'vitest';
import { behaviorEvents, clockInputValue, sessionStart, withClockTime } from '../behavior-timing';

// Times are built in local time, as Data Entry records them.
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();

describe('changing a recorded behavior time by hand', () => {
  it('shows a recorded time as HH:MM for the time box', () => {
    expect(clockInputValue(at(2026, 11, 2, 9, 5))).toBe('09:05');
    expect(clockInputValue(null)).toBe('');
    expect(clockInputValue('not a date')).toBe('');
  });

  it('puts the new time on the session\'s day', () => {
    const tapped = at(2026, 11, 2, 9, 5); // tapped today, for a session dated Oct 28
    const changed = withClockTime(tapped, '13:40', new Date(2026, 9, 28));
    expect(changed).toBe(at(2026, 10, 28, 13, 40));
  });

  it('keeps the recorded day when the session day isn\'t known, and uses today for an entry with no time', () => {
    expect(withClockTime(at(2026, 10, 30, 9, 5), '10:15')).toBe(at(2026, 10, 30, 10, 15));
    const today = new Date();
    expect(withClockTime(null, '08:00')).toBe(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0).toISOString());
  });

  it('clears on an empty box and ignores an unreadable one', () => {
    expect(withClockTime(at(2026, 11, 2, 9, 5), '')).toBeNull();
    expect(withClockTime(at(2026, 11, 2, 9, 5), '25:00')).toBe(at(2026, 11, 2, 9, 5));
  });

  it('is counted at the new time by the time-of-day reports', () => {
    const session = { date: new Date(2026, 9, 28).toISOString(), time: '09:00' };
    // Tapped on another day (while editing later), so not counted as exact until it is moved to the session's day.
    const tapped = at(2026, 11, 2, 9, 5);
    const before = behaviorEvents('BEHAVIOR_FREQUENCY', { count: 1, occurrenceTimes: [tapped] }, sessionStart(session));
    expect(before[0].exact).toBe(false);
    const fixed = withClockTime(tapped, '09:20', new Date(2026, 9, 28));
    const after = behaviorEvents('BEHAVIOR_FREQUENCY', { count: 1, occurrenceTimes: [fixed] }, sessionStart(session));
    expect(after[0]).toMatchObject({ exact: true });
    expect(after[0].at.getHours()).toBe(9);
    expect(after[0].at.getMinutes()).toBe(20);
  });
});
