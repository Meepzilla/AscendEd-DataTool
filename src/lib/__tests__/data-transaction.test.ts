import { describe, expect, it } from 'vitest';
import { isMainListStorageKey, runListTransactionAsync, type AsyncListTransactionStore, type MainListKey } from '../data-transaction';

// An in-memory store for the transaction helper: writes can be made to fail per list,
// and reads can be made to disagree with what was written (a failed verify). Every
// operation is async, as the real store is: a write only resolves after it has landed.
function memoryStore(failWrite: Set<MainListKey> = new Set(), tamperRead: Set<MainListKey> = new Set()) {
  const stored = new Map<MainListKey, unknown>([
    ['students', [{ id: 's1' }]],
    ['goalTemplates', [{ id: 't1' }]],
    ['sessions', [{ sessionId: 'x1' }]],
  ]);
  const snapshots = new Map<MainListKey, unknown>();
  const store: AsyncListTransactionStore = {
    snapshot: key => {
      const value = stored.get(key);
      snapshots.set(key, value);
      return value;
    },
    restore: async (key, snapshot) => void stored.set(key, snapshot),
    write: async (key, value) => {
      if (failWrite.has(key)) return false;
      stored.set(key, value);
      return true;
    },
    read: async key => (tamperRead.has(key) ? { tampered: true } : stored.get(key)),
  };
  return { stored, snapshots, store };
}

const next = {
  students: [{ id: 's2' }],
  goalTemplates: [{ id: 't2' }],
  sessions: [{ sessionId: 'x2' }],
};

describe('runListTransactionAsync', () => {
  it('writes all three lists when every write and verify succeeds', async () => {
    const { stored, store } = memoryStore();
    expect(await runListTransactionAsync({ store, next })).toBe(true);
    expect(stored.get('students')).toEqual(next.students);
    expect(stored.get('goalTemplates')).toEqual(next.goalTemplates);
    expect(stored.get('sessions')).toEqual(next.sessions);
  });

  it('rolls every list back when the last write fails (the delete-student shape)', async () => {
    const { stored, store } = memoryStore(new Set(['sessions']));
    // Delete a student: sessions go first, then the student. The sessions write is
    // the one that fails here, so the students list must come back too.
    const del = { students: [], goalTemplates: [{ id: 't1' }], sessions: [] };
    expect(await runListTransactionAsync({ store, next: del })).toBe(false);
    expect(stored.get('students')).toEqual([{ id: 's1' }]);
    expect(stored.get('goalTemplates')).toEqual([{ id: 't1' }]);
    expect(stored.get('sessions')).toEqual([{ sessionId: 'x1' }]);
  });

  it('rolls back when a write fails on the first list, changing nothing', async () => {
    const { stored, store } = memoryStore(new Set(['students']));
    expect(await runListTransactionAsync({ store, next })).toBe(false);
    expect(stored.get('students')).toEqual([{ id: 's1' }]);
    expect(stored.get('goalTemplates')).toEqual([{ id: 't1' }]);
    expect(stored.get('sessions')).toEqual([{ sessionId: 'x1' }]);
  });

  it('rolls back when a list does not read back as written', async () => {
    const { stored, store } = memoryStore(new Set(), new Set(['goalTemplates']));
    expect(await runListTransactionAsync({ store, next })).toBe(false);
    expect(stored.get('students')).toEqual([{ id: 's1' }]);
    expect(stored.get('goalTemplates')).toEqual([{ id: 't1' }]);
    expect(stored.get('sessions')).toEqual([{ sessionId: 'x1' }]);
  });

  it('rolls back using the snapshot, not the pre-transaction in-memory value', async () => {
    const { stored, store } = memoryStore(new Set(['sessions']));
    // The stored students list changes under the transaction (another writer); the
    // rollback must restore the snapshot taken at the start, whatever it was.
    stored.set('students', [{ id: 's9' }]);
    expect(await runListTransactionAsync({ store, next })).toBe(false);
    expect(stored.get('students')).toEqual([{ id: 's9' }]);
  });

  it('awaits the rollback: a restore that resolves late still lands before it returns false', async () => {
    const { stored, store } = memoryStore(new Set(['sessions']));
    let restored = false;
    const slowStore: AsyncListTransactionStore = {
      ...store,
      restore: async (key, snapshot) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        stored.set(key, snapshot);
        restored = true;
      },
    };
    expect(await runListTransactionAsync({ store: slowStore, next })).toBe(false);
    expect(restored).toBe(true);
    expect(stored.get('students')).toEqual([{ id: 's1' }]);
  });
});

describe('multi-tab storage events', () => {
  const keys = { students: 'ascended_students_v2_u', templates: 'ascended_goal_templates_v2_u', sessions: 'ascended_sessions_v2_u' };
  it('reloads for each of the three lists, for cleared storage, and for nothing else', () => {
    expect(isMainListStorageKey(keys.students, keys)).toBe(true);
    expect(isMainListStorageKey(keys.templates, keys)).toBe(true);
    expect(isMainListStorageKey(keys.sessions, keys)).toBe(true);
    expect(isMainListStorageKey(null, keys)).toBe(true);
    expect(isMainListStorageKey('ascended_abc_lists', keys)).toBe(false);
    expect(isMainListStorageKey('ascended_display_scale', keys)).toBe(false);
  });
});
