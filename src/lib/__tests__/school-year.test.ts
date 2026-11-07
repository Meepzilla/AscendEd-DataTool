import { describe, expect, it } from 'vitest';
import { isMonthDay, schoolYearRange } from '../school-year';

describe('isMonthDay', () => {
  it('accepts real month-days, including Feb 29', () => {
    expect(isMonthDay('08-01')).toBe(true);
    expect(isMonthDay('02-29')).toBe(true);
    expect(isMonthDay('12-31')).toBe(true);
  });
  it('rejects days the month does not have instead of rolling them forward', () => {
    expect(isMonthDay('02-31')).toBe(false);
    expect(isMonthDay('02-30')).toBe(false);
    expect(isMonthDay('04-31')).toBe(false);
    expect(isMonthDay('13-01')).toBe(false);
    expect(isMonthDay('00-10')).toBe(false);
    expect(isMonthDay('8-1')).toBe(false);
  });
});

describe('schoolYearRange', () => {
  it('starts on Aug 1 and ends the day after Jul 31', () => {
    const { start, end } = schoolYearRange(new Date(2026, 8, 15));
    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end).toEqual(new Date(2027, 7, 1));
  });
  it('is still the same school year on Aug 1 itself', () => {
    const { start } = schoolYearRange(new Date(2026, 7, 1));
    expect(start).toEqual(new Date(2026, 7, 1));
  });
});
