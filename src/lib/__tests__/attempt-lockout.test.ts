import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import { clearAttempts, getLockoutRemainingMs, isLockedOut, recordAttempt } from '../attempt-lockout';

// Escalating lockout, with an in-memory localStorage and a controllable clock.

let storage: ReturnType<typeof memoryStorage>;
const T0 = new Date('2026-11-06T12:00:00.000Z').getTime();
const MIN = 60 * 1000;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const failTimes = (namespace: string, n: number) => {
  for (let i = 0; i < n; i++) recordAttempt(namespace, false);
};

describe('attempt lockout', () => {
  it('has no lockout for failures 1-4', () => {
    failTimes('access-pin', 4);
    expect(isLockedOut('access-pin')).toBe(false);
    expect(getLockoutRemainingMs('access-pin')).toBe(0);
  });

  it('escalates: 1 min after the 5th failure, 5 min after the 6th, 15 min after the 7th, 60 min after the 8th and later', () => {
    failTimes('access-pin', 5);
    expect(isLockedOut('access-pin')).toBe(true);
    expect(getLockoutRemainingMs('access-pin')).toBe(1 * MIN);

    recordAttempt('access-pin', false);
    expect(getLockoutRemainingMs('access-pin')).toBe(5 * MIN);

    recordAttempt('access-pin', false);
    expect(getLockoutRemainingMs('access-pin')).toBe(15 * MIN);

    recordAttempt('access-pin', false);
    expect(getLockoutRemainingMs('access-pin')).toBe(60 * MIN);

    recordAttempt('access-pin', false);
    expect(getLockoutRemainingMs('access-pin')).toBe(60 * MIN);
  });

  it('expires: the lockout ends once its duration has passed', () => {
    failTimes('access-pin', 5);
    expect(isLockedOut('access-pin', T0 + 59 * 1000)).toBe(true);
    expect(isLockedOut('access-pin', T0 + 60 * 1000)).toBe(false);
    expect(getLockoutRemainingMs('access-pin', T0 + 60 * 1000)).toBe(0);
    expect(getLockoutRemainingMs('access-pin', T0 + 61 * 1000)).toBe(0);
  });

  it('escalates from where the count left off after a lockout expires', () => {
    failTimes('access-pin', 5);
    vi.setSystemTime(T0 + 61 * 1000);
    expect(isLockedOut('access-pin')).toBe(false);
    recordAttempt('access-pin', false);
    expect(getLockoutRemainingMs('access-pin')).toBe(5 * MIN);
  });

  it('clears the count on success, so the next failure starts over at 1', () => {
    failTimes('access-pin', 5);
    expect(isLockedOut('access-pin')).toBe(true);
    recordAttempt('access-pin', true);
    expect(isLockedOut('access-pin')).toBe(false);
    expect(getLockoutRemainingMs('access-pin')).toBe(0);
    failTimes('access-pin', 4);
    expect(isLockedOut('access-pin')).toBe(false);
  });

  it('clears the count with clearAttempts', () => {
    failTimes('access-pin', 5);
    expect(isLockedOut('access-pin')).toBe(true);
    clearAttempts('access-pin');
    expect(isLockedOut('access-pin')).toBe(false);
  });

  it('keeps namespaces independent', () => {
    failTimes('access-pin', 5);
    expect(isLockedOut('access-pin')).toBe(true);
    expect(isLockedOut('passcode')).toBe(false);
  });

  it('persists across a fresh module load', async () => {
    failTimes('access-pin', 5);
    vi.resetModules();
    const fresh = await import('../attempt-lockout');
    expect(fresh.isLockedOut('access-pin')).toBe(true);
    expect(fresh.getLockoutRemainingMs('access-pin')).toBe(1 * MIN);
  });
});

describe('lockout when storage is full', () => {
  it('still counts failures when storage can be read but not written', () => {
    const full = memoryStorage();
    vi.stubGlobal('localStorage', { ...full, getItem: full.getItem, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: full.removeItem });
    clearAttempts('full-test');
    for (let i = 0; i < 10; i++) recordAttempt('full-test', false);
    expect(isLockedOut('full-test')).toBe(true);
    recordAttempt('full-test', true);
    expect(isLockedOut('full-test')).toBe(false);
  });
});
