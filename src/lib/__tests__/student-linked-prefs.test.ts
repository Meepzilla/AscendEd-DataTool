import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// Preferences that name a student or goal by id stay out of plain storage while passcode protection is on.
// Each test loads fresh copies of the modules (secure-store keeps the key in memory).

const REPORT_STUDENT = 'ascended_report_student';
const REPORT_GOALS = 'ascended_report_goals';
const INTERVAL_SETUPS = 'ascended_interval_setups';

let storage: ReturnType<typeof memoryStorage>;
let store: typeof import('../secure-store');
let prefs: typeof import('../student-linked-prefs');
let filters: typeof import('../report-filters');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
  vi.resetModules();
  store = await import('../secure-store');
  prefs = await import('../student-linked-prefs');
  filters = await import('../report-filters');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('student-linked preferences', () => {
  it('are kept in localStorage while passcode protection is off', () => {
    filters.rememberReportStudent('st1');
    filters.rememberGoalChoice('st1', 'g2');
    expect(storage.getItem(REPORT_STUDENT)).toBe('st1');
    expect(JSON.parse(storage.getItem(REPORT_GOALS)!)).toEqual({ st1: 'g2' });
    expect(filters.defaultReportStudent(['st0', 'st1'])).toBe('st1');
    expect(filters.readGoalChoice('st1', ['g1', 'g2'])).toBe('g2');
  });

  it('turning passcode protection on removes the stored copies', async () => {
    storage.setItem(REPORT_STUDENT, 'st1');
    storage.setItem(REPORT_GOALS, '{"st1":"g2"}');
    storage.setItem(INTERVAL_SETUPS, '{"g2":{"intervalSeconds":30}}');
    storage.setItem('ascended_report_tab', '"goals"');
    await store.enablePasscode('passcode1');
    expect(storage.getItem(REPORT_STUDENT)).toBeNull();
    expect(storage.getItem(REPORT_GOALS)).toBeNull();
    expect(storage.getItem(INTERVAL_SETUPS)).toBeNull();
    // Preferences that name no student are left alone.
    expect(storage.getItem('ascended_report_tab')).toBe('"goals"');
  }, 30000);

  it('while protection is on, are remembered in memory only', async () => {
    await store.enablePasscode('passcode1');
    filters.rememberReportStudent('st1');
    filters.rememberGoalChoice('st1', 'g2');
    prefs.writeStudentLinkedPref(INTERVAL_SETUPS, '{"g2":{}}');
    expect(storage.getItem(REPORT_STUDENT)).toBeNull();
    expect(storage.getItem(REPORT_GOALS)).toBeNull();
    expect(storage.getItem(INTERVAL_SETUPS)).toBeNull();
    expect(filters.defaultReportStudent(['st0', 'st1'])).toBe('st1');
    expect(filters.readGoalChoice('st1', ['g1', 'g2'])).toBe('g2');
    expect(prefs.readStudentLinkedPref(INTERVAL_SETUPS)).toBe('{"g2":{}}');

    // A reload (or lock, which reloads) forgets them.
    vi.resetModules();
    const freshFilters = await import('../report-filters');
    expect(freshFilters.defaultReportStudent(['st0', 'st1'])).toBe('st0');
  }, 30000);

  it('while protection is on, a stored copy left from before is removed when read, not used', async () => {
    await store.enablePasscode('passcode1');
    storage.setItem(REPORT_STUDENT, 'st1');
    expect(filters.defaultReportStudent(['st0', 'st1'])).toBe('st0');
    expect(storage.getItem(REPORT_STUDENT)).toBeNull();
  }, 30000);

  it('clearing a preference removes it from memory and storage', () => {
    filters.rememberGoalChoice('st1', 'g2');
    filters.rememberGoalChoice('st1', undefined);
    expect(storage.getItem(REPORT_GOALS)).toBeNull();
    expect(filters.readGoalChoice('st1', ['g2'])).toBeUndefined();
  });
});
