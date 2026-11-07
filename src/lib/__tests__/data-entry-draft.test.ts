import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import type { DataEntryDraft } from '../data-entry-draft';

// data-entry-draft.ts: a failed draft save is no longer swallowed — saveDataEntryDraft returns
// whether it landed and records the failure, so the Data Entry screen can show the draft did not
// persist and offer a retry.
let storage: ReturnType<typeof memoryStorage>;
let draft: typeof import('../data-entry-draft');
let failures: typeof import('../storage-failure');

const draftValue = (overrides: Partial<DataEntryDraft> = {}): DataEntryDraft => ({
  savedAt: '2026-11-06T10:00:00.000Z',
  sessionTime: '09:00',
  sessionEndTime: '09:30',
  selectedStudentIds: ['s1'],
  focusedStudentSlotIndex: 0,
  focusedGoalIndexByStudentId: {},
  isStudentAccessLocked: false,
  isHeaderCardCollapsed: false,
  students: { s1: { activity: 'Circle time', notes: '', goalData: {} } },
  ...overrides,
});

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  draft = await import('../data-entry-draft');
  failures = await import('../storage-failure');
});

describe('saveDataEntryDraft', () => {
  it('saves the draft and returns true, and it loads back', () => {
    expect(draft.saveDataEntryDraft('u', draftValue())).toBe(true);
    expect(draft.loadDataEntryDraft('u')).toEqual(draftValue());
    expect(failures.getStorageFailure('draft')).toBe(null);
  });

  it('returns false and records the failure when storage is full', () => {
    const original = storage.setItem;
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith('ascended_data_entry_draft_v1_')) throw new DOMException('Storage is full', 'QuotaExceededError');
      return original(k, v);
    };
    expect(draft.saveDataEntryDraft('u', draftValue())).toBe(false);
    expect(draft.saveDataEntryDraft('u', draftValue())).toBe(false);
    expect(failures.getStorageFailure('draft')).toMatchObject({ source: 'draft', quota: true });
    expect(draft.loadDataEntryDraft('u')).toBe(null);
    storage.setItem = original;
    // A later save landing clears the failure, so the indicator goes away.
    expect(draft.saveDataEntryDraft('u', draftValue())).toBe(true);
    expect(failures.getStorageFailure('draft')).toBe(null);
  });

  it('returns true without a user (nothing to save it for)', () => {
    expect(draft.saveDataEntryDraft(undefined, draftValue())).toBe(true);
    expect(failures.getStorageFailures()).toHaveLength(0);
  });
});
