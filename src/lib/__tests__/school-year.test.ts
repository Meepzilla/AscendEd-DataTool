import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMonthDay, schoolYearRange, setSchoolYearSetting, getSchoolYearSetting } from '../school-year';
import { getStorageFailure } from '../storage-failure';
import { memoryStorage } from './helpers';

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

describe('setSchoolYearSetting', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves the setting and returns true', () => {
    expect(setSchoolYearSetting({ start: '08-15', end: '06-10' })).toBe(true);
    expect(getSchoolYearSetting()).toEqual({ start: '08-15', end: '06-10' });
    expect(getStorageFailure('school-year')).toBe(null);
  });

  it('returns false and records the failure when storage is full', () => {
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    expect(setSchoolYearSetting({ start: '09-01', end: '06-15' })).toBe(false);
    expect(getStorageFailure('school-year')).toMatchObject({ quota: true });
  });
});
