import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllListStores, clearStore, deleteRecords, getAllRecords, getRecordCount, putRecords,
  resetMemoryIndexedDb, setIndexedDbWriteFailure, useMemoryIndexedDb,
} from '../indexed-db-store';

// The IndexedDB wrapper, exercised through its in-memory fallback (the vitest
// environment is node, which has no indexedDB). The fallback has the same
// semantics as the real stores: one row per record, list order kept, deletes stick.
beforeEach(() => {
  useMemoryIndexedDb();
  resetMemoryIndexedDb();
});

describe('indexed-db-store (in-memory fallback)', () => {
  it('round-trips rows and returns them in list order, not id order', async () => {
    await putRecords('students', [
      { k: 's2', v: '{"id":"s2","name":"Ben"}', o: 1 },
      { k: 's1', v: '{"id":"s1","name":"Ava"}', o: 0 },
    ]);
    expect(await getAllRecords('students')).toEqual([
      { k: 's1', v: '{"id":"s1","name":"Ava"}', o: 0 },
      { k: 's2', v: '{"id":"s2","name":"Ben"}', o: 1 },
    ]);
    expect(await getRecordCount('students')).toBe(2);
  });

  it('replaces a row with the same key and deletes stale rows', async () => {
    await putRecords('sessions', [
      { k: 'x1', v: 'one', o: 0 },
      { k: 'x2', v: 'two', o: 1 },
    ]);
    await putRecords('sessions', [{ k: 'x1', v: 'one-updated', o: 0 }]);
    await deleteRecords('sessions', ['x2']);
    expect(await getAllRecords('sessions')).toEqual([{ k: 'x1', v: 'one-updated', o: 0 }]);
  });

  it('keeps the three list stores separate', async () => {
    await putRecords('students', [{ k: 's1', v: 'student', o: 0 }]);
    await putRecords('goalTemplates', [{ k: 's1', v: 'template', o: 0 }]);
    expect(await getAllRecords('students')).toEqual([{ k: 's1', v: 'student', o: 0 }]);
    expect(await getAllRecords('goalTemplates')).toEqual([{ k: 's1', v: 'template', o: 0 }]);
    await clearStore('students');
    expect(await getRecordCount('students')).toBe(0);
    expect(await getRecordCount('goalTemplates')).toBe(1);
  });

  it('clearAllListStores empties every list store', async () => {
    await putRecords('students', [{ k: 's1', v: 'x', o: 0 }]);
    await putRecords('sessions', [{ k: 'x1', v: 'y', o: 0 }]);
    await clearAllListStores();
    expect(await getRecordCount('students')).toBe(0);
    expect(await getRecordCount('sessions')).toBe(0);
    expect(await getRecordCount('goalTemplates')).toBe(0);
  });

  it('a failing write throws instead of resolving, so the caller can report it', async () => {
    setIndexedDbWriteFailure(true);
    await expect(putRecords('students', [{ k: 's1', v: 'x', o: 0 }])).rejects.toThrow();
    expect(await getRecordCount('students')).toBe(0);
    setIndexedDbWriteFailure(false);
    await putRecords('students', [{ k: 's1', v: 'x', o: 0 }]);
    expect(await getRecordCount('students')).toBe(1);
  });
});
