import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// A save rewrites only the records that changed (secure-store knownRows). Each test loads fresh modules with an
// in-memory localStorage and IndexedDB. With protection on every write encrypts with a new random IV, so a row that
// was rewritten always has a new stored value, and a row left alone keeps its old one.
const S = 'ascended_students_v2_u';
const T = 'ascended_goal_templates_v2_u';
const X = 'ascended_sessions_v2_u';
const keys = { students: S, templates: T, sessions: X };

let storage: ReturnType<typeof memoryStorage>;
let idb: typeof import('../indexed-db-store');
let store: typeof import('../secure-store');
let dataStore: typeof import('../data-store');

async function load(rows?: Record<string, import('../indexed-db-store').IdRecord[]>) {
  vi.resetModules();
  idb = await import('../indexed-db-store');
  idb.useMemoryIndexedDb();
  idb.resetMemoryIndexedDb();
  if (rows) for (const [name, list] of Object.entries(rows)) await idb.putRecords(name as never, list);
  store = await import('../secure-store');
  store.setPersistRetryDelaysForTests([0, 0]);
  dataStore = await import('../data-store');
}

const session = (id: string, note = '') => ({ sessionId: id, studentId: 's1', date: '2026-11-02', notes: note });
const values = async () => Object.fromEntries((await idb.getAllRecords('sessions')).map(r => [r.k, r.v]));

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
  await load();
});

describe('with protection on', () => {
  beforeEach(async () => {
    await store.enablePasscode('passcode1');
    await dataStore.hydrateLists(keys);
    await store.setItemAsync(X, JSON.stringify([session('x1'), session('x2'), session('x3')]));
  }, 30000);

  it('re-encrypts only the record that changed, and every row still opens as saved', async () => {
    const before = await values();
    const list = [session('x1'), session('x2', 'edited'), session('x3')];
    await store.setItemAsync(X, JSON.stringify(list));
    const after = await values();
    expect(after.x1).toBe(before.x1);
    expect(after.x3).toBe(before.x3);
    expect(after.x2).not.toBe(before.x2);
    expect(Object.values(after).every(v => v.startsWith('enc1:'))).toBe(true);
    expect(await store.readDurableList(X)).toEqual(list);
  });

  it('adds, removes and reorders records, keeping the list order', async () => {
    const list = [session('x0'), session('x3'), session('x1')];
    await store.setItemAsync(X, JSON.stringify(list));
    expect(await store.readDurableList(X)).toEqual(list);
    expect((await idb.getAllRecords('sessions')).map(r => r.k)).toEqual(['x0', 'x3', 'x1']);
  });

  it('rewrites a row that changed in storage behind its back (another tab), instead of trusting what it last saw', async () => {
    const other = await store.encryptStoredValue(X, JSON.stringify(session('x2', 'from another tab')));
    await idb.putRecords('sessions', [{ k: 'x2', v: other, o: 1 }]);
    const list = [session('x1', 'edited'), session('x2'), session('x3')];
    await store.setItemAsync(X, JSON.stringify(list));
    expect(await store.readDurableList(X)).toEqual(list);
  });

  it('after the app is reopened and unlocked, the first save also rewrites only what changed', async () => {
    const rows = { sessions: await idb.getAllRecords('sessions'), students: await idb.getAllRecords('students') };
    await load(rows);
    expect(await store.unlock('passcode1')).toBe(true);
    await dataStore.hydrateLists(keys);
    const before = await values();
    const list = [session('x1'), session('x2'), session('x3', 'edited')];
    await store.setItemAsync(X, JSON.stringify(list));
    const after = await values();
    expect(after.x1).toBe(before.x1);
    expect(after.x2).toBe(before.x2);
    expect(after.x3).not.toBe(before.x3);
    expect(await store.readDurableList(X)).toEqual(list);
  }, 30000);

  it('checking a save still catches a stored row that differs, without trusting what it last saw', async () => {
    const list = [session('x1'), session('x2'), session('x3')];
    expect(await store.verifyStoredList(X, list)).toBe(true);
    // The same record stored again with a new IV: decrypted and compared, and still matches.
    const same = await store.encryptStoredValue(X, JSON.stringify(session('x2')));
    await idb.putRecords('sessions', [{ k: 'x2', v: same, o: 1 }]);
    expect(await store.verifyStoredList(X, list)).toBe(true);
    // A different record under the same id: caught.
    const other = await store.encryptStoredValue(X, JSON.stringify(session('x2', 'changed')));
    await idb.putRecords('sessions', [{ k: 'x2', v: other, o: 1 }]);
    expect(await store.verifyStoredList(X, list)).toBe(false);
    // A missing row: caught.
    await idb.deleteRecords('sessions', ['x3']);
    expect(await store.verifyStoredList(X, list)).toBe(false);
  });

  it('turning protection off writes every row as plain text', async () => {
    await store.disablePasscode('passcode1');
    const rows = await idb.getAllRecords('sessions');
    expect(rows.map(r => JSON.parse(r.v).sessionId)).toEqual(['x1', 'x2', 'x3']);
  }, 30000);
});

it('turning protection on encrypts every row, including ones saved before as plain text', async () => {
  await dataStore.hydrateLists(keys);
  await store.setItemAsync(X, JSON.stringify([session('x1'), session('x2')]));
  expect((await idb.getAllRecords('sessions')).every(r => !r.v.startsWith('enc1:'))).toBe(true);
  await store.enablePasscode('passcode1');
  expect((await idb.getAllRecords('sessions')).every(r => r.v.startsWith('enc1:'))).toBe(true);
  await store.setItemAsync(X, JSON.stringify([session('x1'), session('x2', 'edited')]));
  expect((await idb.getAllRecords('sessions')).every(r => r.v.startsWith('enc1:'))).toBe(true);
}, 30000);
