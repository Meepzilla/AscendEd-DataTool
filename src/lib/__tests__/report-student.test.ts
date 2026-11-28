import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultReportStudent, rememberReportStudent } from '../report-filters';
import { memoryStorage } from './helpers';

describe('the student remembered on Reports', () => {
  beforeEach(() => { vi.stubGlobal('window', { localStorage: memoryStorage() }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('opens on the first student until one is chosen', () => {
    expect(defaultReportStudent(['a', 'b'])).toBe('a');
    expect(defaultReportStudent([])).toBeUndefined();
  });

  it('opens on the student chosen last time', () => {
    rememberReportStudent('b');
    expect(defaultReportStudent(['a', 'b'])).toBe('b');
  });

  it('falls back to the first student when the remembered one was archived or deleted', () => {
    rememberReportStudent('gone');
    expect(defaultReportStudent(['a', 'b'])).toBe('a');
  });

  it('still works when storage is unavailable', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(() => rememberReportStudent('b')).not.toThrow();
    // Kept in memory instead, so the choice still holds for this visit.
    expect(defaultReportStudent(['a', 'b'])).toBe('b');
  });
});
