import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// IndexedDB migration (data-store.ts hydrateLists), with an in-memory localStorage
// and the in-memory IndexedDB fallback (the vitest environment is node, which has
// no indexedDB). Each test loads fresh copies of the modules (secure-store keeps
// the key, cache and backend map in memory).
const S = 'ascended_students_v2_u';
const T = 'ascended_goal_templates_v2_u';
const X = 'ascended_sessions_v2_u';
const FLAG = 'ascended_idb_migrated_v1';

let storage: ReturnType<typeof memoryStorage>;
let store: typeof import('../secure-store');
let dataStore: typeof import('../data-store');
let idb: typeof import('../indexed-db-store');

async function freshModules(withMemoryDb: boolean) {
  vi.resetModules();
  idb = await import('../indexed-db-store');
  if (withMemoryDb) {
    idb.useMemoryIndexedDb();
    idb.resetMemoryIndexedDb();
  }
  store = await import('../secure-store');
  dataStore = await import('../data-store');
}

const studentsBlob = JSON.stringify([
  { id: 's1', name: 'Ava', goals: [], createdAt: '2026-01-01', userId: 'u', isArchived: false },
  { id: 's2', name: 'Ben', goals: [], createdAt: '2026-01-01', userId: 'u', isArchived: false },
]);
const templatesBlob = JSON.stringify([{ id: 't1', name: 'Goal', type: 'ARTICULATION', createdAt: '2026-01-01' }]);
const sessionsBlob = JSON.stringify([{ sessionId: 'x1', studentId: 's1', studentName: 'Ava', date: '2026-10-05', time: '09:00', goals: [] }]);

describe('hydrateLists with IndexedDB', () => {
  beforeEach(async () => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', globalThis);
    await freshModules(true);
  });

  it('migrates localStorage blobs to per-record rows, verifies, then removes the blobs', async () => {
    storage.setItem(S, studentsBlob);
    storage.setItem(T, templatesBlob);
    storage.setItem(X, sessionsBlob);
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.map(r => r.status)).toEqual(['migrated', 'migrated', 'migrated']);

    // One row per record, in list order, holding the record's JSON.
    expect(await idb.getAllRecords('students')).toHaveLength(2);
    expect(await idb.getAllRecords('goalTemplates')).toHaveLength(1);
    expect(await idb.getAllRecords('sessions')).toHaveLength(1);
    expect(JSON.parse((await idb.getAllRecords('students'))[0].v)).toMatchObject({ id: 's1', name: 'Ava' });

    // The blobs are gone and the flag is set; the lists still read the same.
    expect(storage.getItem(S)).toBe(null);
    expect(storage.getItem(T)).toBe(null);
    expect(storage.getItem(X)).toBe(null);
    expect(JSON.parse(storage.getItem(FLAG) ?? '{}')).toMatchObject({ [S]: true, [T]: true, [X]: true });
    expect(dataStore.readList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
    expect(dataStore.readList(X)).toMatchObject([{ sessionId: 'x1' }]);

    // A second load reads the rows back and changes nothing.
    const again = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(again.map(r => r.status)).toEqual(['already', 'already', 'already']);
    expect(dataStore.readList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
  });

  it('writes straight to IndexedDB when nothing was stored', async () => {
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.map(r => r.status)).toEqual(['empty', 'empty', 'empty']);
    expect(dataStore.readList(S)).toEqual([]);
    await store.setItemAsync(S, studentsBlob);
    expect(await store.readDurableList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
    expect(storage.getItem(S)).toBe(null);
  });

  it('leaves a corrupt blob exactly as stored and never migrates it', async () => {
    storage.setItem(S, '{not json');
    storage.setItem(T, '"not a list"');
    storage.setItem(X, JSON.stringify([{ studentId: 's1' }]));
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.map(r => r.status)).toEqual(['skipped-corrupt', 'skipped-corrupt', 'skipped-corrupt']);
    expect(storage.getItem(S)).toBe('{not json');
    expect(storage.getItem(T)).toBe('"not a list"');
    expect(storage.getItem(X)).toBe(JSON.stringify([{ studentId: 's1' }]));
    expect(storage.getItem(FLAG)).toBe(null);
    expect(await idb.getRecordCount('students')).toBe(0);
    expect(await idb.getRecordCount('sessions')).toBe(0);
    // Damaged lists stay unreadable (and so are never written over).
    expect(dataStore.readList(S)).toBe(undefined);
  });

  it('does not flag a migration whose verification fails, and keeps the blob', async () => {
    storage.setItem(S, studentsBlob);
    idb.setIndexedDbWriteFailure(true);
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.find(r => r.key === S)?.status).toBe('failed');
    expect(storage.getItem(S)).toBe(studentsBlob);
    expect(JSON.parse(storage.getItem(FLAG) ?? '{}')).not.toHaveProperty(S);
    expect(await idb.getRecordCount('students')).toBe(0);

    // The next load retries and migrates.
    idb.setIndexedDbWriteFailure(false);
    const retry = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(retry.find(r => r.key === S)?.status).toBe('migrated');
    expect(storage.getItem(S)).toBe(null);
  });

  it('migrates an encrypted blob per record, still encrypted', async () => {
    storage.setItem(S, studentsBlob);
    await store.enablePasscode('passcode1');
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.find(r => r.key === S)?.status).toBe('migrated');
    const rows = await idb.getAllRecords('students');
    expect(rows).toHaveLength(2);
    expect(rows[0].v.startsWith('enc1:')).toBe(true);
    expect(await store.readDurableList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
    expect(storage.getItem(S)).toBe(null);
  }, 30000);

  it('re-encrypts IndexedDB rows on passcode change and stores them plain on disable', async () => {
    await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    await store.setItemAsync(S, studentsBlob);
    await store.enablePasscode('passcode1');
    expect((await idb.getAllRecords('students'))[0].v.startsWith('enc1:')).toBe(true);
    await store.changePasscode('passcode1', 'passcode2');
    expect(await store.readDurableList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
    await store.disablePasscode('passcode2');
    const rows = await idb.getAllRecords('students');
    expect(rows[0].v.startsWith('enc1:')).toBe(false);
    expect(await store.readDurableList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
    expect(dataStore.readList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
  }, 60000);
});

describe('hydrateLists without IndexedDB', () => {
  beforeEach(async () => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', globalThis);
    await freshModules(false);
  });

  it('keeps the lists in localStorage and still reads them', async () => {
    storage.setItem(S, studentsBlob);
    const results = await dataStore.hydrateLists({ students: S, templates: T, sessions: X });
    expect(results.map(r => r.status)).toEqual(['skipped-no-idb', 'skipped-no-idb', 'skipped-no-idb']);
    expect(storage.getItem(S)).toBe(studentsBlob);
    expect(dataStore.readList(S)).toMatchObject([{ id: 's1' }, { id: 's2' }]);
  });
});
