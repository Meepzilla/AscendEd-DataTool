import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shared record of unresolved storage failures (see storage-failure.ts). Each test loads a
// fresh copy of the module, since the record is module state.
let failures: typeof import('../storage-failure');

beforeEach(async () => {
  vi.resetModules();
  failures = await import('../storage-failure');
});

describe('reportStorageFailure', () => {
  it('records a failure once and reports it as new only the first time', () => {
    expect(failures.reportStorageFailure('draft')).toBe(true);
    expect(failures.reportStorageFailure('draft')).toBe(false);
    expect(failures.getStorageFailures()).toHaveLength(1);
    expect(failures.getStorageFailure('draft')).toMatchObject({ source: 'draft', label: 'Data Entry draft', quota: false });
    expect(failures.getStorageFailure('draft')!.detail).toContain('only kept on this screen');
  });

  it('records a new failure when the quota state changes', () => {
    expect(failures.reportStorageFailure('save')).toBe(true);
    expect(failures.reportStorageFailure('save', new DOMException('Storage is full', 'QuotaExceededError'))).toBe(true);
    expect(failures.getStorageFailure('save')).toMatchObject({ quota: true });
  });

  it('clears a failure, and a later failure is new again', () => {
    failures.reportStorageFailure('theme');
    failures.clearStorageFailure('theme');
    expect(failures.getStorageFailures()).toHaveLength(0);
    expect(failures.getStorageFailure('theme')).toBe(null);
    expect(failures.reportStorageFailure('theme')).toBe(true);
  });

  it('keeps failures per source and notifies subscribers on change', () => {
    const listener = vi.fn();
    const unsubscribe = failures.subscribeStorageFailures(listener);
    failures.reportStorageFailure('draft');
    failures.reportStorageFailure('school-year');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(failures.getStorageFailures().map(f => f.source)).toEqual(['draft', 'school-year']);
    unsubscribe();
    failures.clearStorageFailure('draft');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('isQuotaError', () => {
  it('recognises quota errors by name and by message', () => {
    expect(failures.isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true);
    expect(failures.isQuotaError(new Error('QuotaExceededError: storage is full'))).toBe(true);
    expect(failures.isQuotaError(new Error('Storage is full'))).toBe(true);
    expect(failures.isQuotaError(new Error('boom'))).toBe(false);
    expect(failures.isQuotaError(null)).toBe(false);
    expect(failures.isQuotaError('QuotaExceededError')).toBe(false);
  });
});

describe('sourceForStorageKey', () => {
  it('maps a background write failure back to the thing that failed to save', () => {
    expect(failures.sourceForStorageKey('ascended_data_entry_draft_v1_local-guest-user')).toBe('draft');
    expect(failures.sourceForStorageKey('ascended_student_groups_v1_local-guest-user')).toBe('student-groups');
    expect(failures.sourceForStorageKey('ascended_abc_lists')).toBe('abc-lists');
    expect(failures.sourceForStorageKey('ascended_students_v2_local-guest-user')).toBe('save');
  });
});
