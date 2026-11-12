import { beforeEach, describe, expect, it, vi } from 'vitest';

// A failed multi-list transaction (Restore → Replace, a large import) rolls every list back. A list with a row that
// can't be read lives only in IndexedDB, so its rows themselves have to be copied before the transaction: putting
// back its (empty) localStorage value lost them.

const S = 'ascended_students_v2_u', T = 'ascended_goal_templates_v2_u', X = 'ascended_sessions_v2_u';
function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    clear: () => store.clear(),
    get length() { return store.size; },
  };
}

let idb: typeof import('../indexed-db-store');
let secureStore: typeof import('../secure-store');
let dataStore: typeof import('../data-store');
let tx: typeof import('../data-transaction');
beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', globalThis);
  vi.resetModules();
  idb = await import('../indexed-db-store');
  idb.useMemoryIndexedDb();
  idb.resetMemoryIndexedDb();
  secureStore = await import('../secure-store');
  secureStore.setPersistRetryDelaysForTests([0, 0]);
  dataStore = await import('../data-store');
  tx = await import('../data-transaction');
});

describe('rolling back a list with an unreadable row', () => {
  it('puts the rows back exactly as they were', async () => {
    localStorage.setItem('ascended_idb_migrated_v1', JSON.stringify({ [S]: true, [T]: true, [X]: true }));
    const original = [{ k: 'a', v: '{"id":"a","name":"Ava"}', o: 0 }, { k: 'b', v: '{not json', o: 1 }];
    await idb.putRecords('students', original);
    const hydrated = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(hydrated[0].status).toBe('skipped-corrupt');

    const keyOf = { students: S, goalTemplates: T, sessions: X } as const;
    const ok = await tx.runListTransactionAsync({
      store: {
        snapshot: key => secureStore.snapshotItemAsync(keyOf[key]),
        restore: (key, snapshot) => secureStore.restoreItemAsync(keyOf[key], snapshot as import('../secure-store').ItemSnapshot),
        write: async (key, value) => {
          if (key === 'sessions') return false; // the last list fails to save (storage full)
          await secureStore.setItemAsync(keyOf[key], JSON.stringify(value));
          return true;
        },
        read: key => secureStore.readDurableList(keyOf[key]),
      },
      next: { students: [{ id: 'z', name: 'From the backup' }], goalTemplates: [], sessions: [] },
    });
    expect(ok).toBe(false);
    expect(await idb.getAllRecords('students')).toEqual(original);
  });
});
