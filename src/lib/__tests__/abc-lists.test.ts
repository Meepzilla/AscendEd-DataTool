import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// abc-lists.ts: a failed save used to be silent ("the lists just aren't kept"). It is now recorded
// (persistent warning) and thrown, so the settings card — or a restore, through its onError — can say so.
let storage: ReturnType<typeof memoryStorage>;
let abc: typeof import('../abc-lists');
let failures: typeof import('../storage-failure');

import type { AbcLists } from '../abc-lists';

const lists: AbcLists = {
  antecedents: ['Asked to wait'],
  behaviors: ['Hit'],
  consequences: [{ label: 'Redirected', fn: null }],
};

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  abc = await import('../abc-lists');
  failures = await import('../storage-failure');
});

describe('saveAbcLists', () => {
  it('saves lists and reads them back', () => {
    abc.saveAbcLists(lists);
    expect(abc.loadCustomAbcLists()).toEqual({ antecedents: ['Asked to wait'], behaviors: ['Hit'], consequences: [{ label: 'Redirected', fn: null }] });
    expect(failures.getStorageFailure('abc-lists')).toBe(null);
  });

  it('throws and records the failure when storage is full', () => {
    const original = storage.setItem;
    storage.setItem = (k: string, v: string) => {
      if (k === 'ascended_abc_lists') throw new DOMException('Storage is full', 'QuotaExceededError');
      return original(k, v);
    };
    expect(() => abc.saveAbcLists(lists))
      .toThrow('could not be saved');
    expect(failures.getStorageFailure('abc-lists')).toMatchObject({ quota: true });
    expect(abc.loadCustomAbcLists()).toBe(null);
    storage.setItem = original;
    abc.saveAbcLists(lists);
    expect(failures.getStorageFailure('abc-lists')).toBe(null);
  });

  it('resetting to the defaults removes the stored lists', () => {
    abc.saveAbcLists(lists);
    abc.saveAbcLists(null);
    expect(abc.loadCustomAbcLists()).toBe(null);
  });
});
