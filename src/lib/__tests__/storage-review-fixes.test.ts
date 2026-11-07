import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// Fixes from the review of the storage and passcode changes (#121, #123). Each test loads fresh modules (secure-store
// keeps the key and cache in memory) with an in-memory localStorage and the in-memory IndexedDB, and "reloads" by
// loading the modules again over the same stored rows.
const S = 'ascended_students_v2_u';
const T = 'ascended_goal_templates_v2_u';
const X = 'ascended_sessions_v2_u';
const CONFIG_KEY = 'ascended_passcode_v1';
const MIGRATION_FLAG_KEY = 'ascended_idb_migrated_v1';
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

async function allRows() {
  return { students: await idb.getAllRecords('students'), sessions: await idb.getAllRecords('sessions') };
}

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
  await load();
});

describe('an install whose lists moved to IndexedDB', () => {
  beforeEach(async () => {
    storage.setItem(S, JSON.stringify([{ id: 's1', name: 'Ava' }]));
    storage.setItem(X, JSON.stringify([{ sessionId: 'x1', studentId: 's1' }]));
    await dataStore.hydrateLists(keys);
    expect(storage.getItem(S)).toBeNull(); // the localStorage copy is gone after migrating
    await load(await allRows()); // the app is opened again: nothing loaded yet
  });

  it('is still recognized as an existing install (offer and backup step, not the fresh-install setup)', async () => {
    const onboarding = await import('../passcode-onboarding');
    expect(onboarding.hasExistingStudentData()).toBe(true);
    expect(onboarding.needsFirstRunPrompt()).toBe(false);
    expect(onboarding.needsPasscodeOffer()).toBe(true);
  });

  it('turning protection on before the lists are loaded encrypts every row, which still opens after unlocking', async () => {
    await store.enablePasscode('passcode1');
    const rows = await allRows();
    expect(rows.students[0].v.startsWith('enc1:')).toBe(true);
    expect(rows.sessions[0].v.startsWith('enc1:')).toBe(true);
    await load(rows);
    expect(await store.unlock('passcode1')).toBe(true);
    await dataStore.hydrateLists(keys);
    expect(store.getItem(S)).toContain('Ava');
    expect(store.getItem(X)).toContain('x1');
  }, 30000);
});

it('rows left plaintext by the earlier bug are encrypted on the next unlock', async () => {
  await store.enablePasscode('passcode1');
  await load({ students: [{ k: 's1', v: '{"id":"s1","name":"Ava"}', o: 0 }] });
  storage.setItem(MIGRATION_FLAG_KEY, JSON.stringify({ [S]: true }));
  expect(await store.unlock('passcode1')).toBe(true);
  const [row] = await idb.getAllRecords('students');
  expect(row.v.startsWith('enc1:')).toBe(true);
  await dataStore.hydrateLists(keys);
  expect(store.getItem(S)).toContain('Ava');
}, 30000);

describe('turning protection off', () => {
  beforeEach(async () => {
    storage.setItem(S, JSON.stringify([{ id: 's1', name: 'Ava' }, { id: 's2', name: 'Ben' }]));
    await dataStore.hydrateLists(keys);
    await store.enablePasscode('passcode1');
    expect((await idb.getAllRecords('students'))[0].v.startsWith('enc1:')).toBe(true);
  });

  it('when a write fails part way, protection stays on, every row still opens, and trying again works', async () => {
    idb.setIndexedDbWriteFailure(true);
    await expect(store.disablePasscode('passcode1')).rejects.toThrow();
    idb.setIndexedDbWriteFailure(false);
    expect(store.isPasscodeEnabled()).toBe(true);
    expect(storage.getItem(CONFIG_KEY)).not.toBeNull();

    // Opened again later: the passcode still unlocks and the students are all there.
    const rows = await allRows();
    await load(rows);
    expect(await store.unlock('passcode1')).toBe(true);
    const results = await dataStore.hydrateLists(keys);
    expect(results.find(r => r.key === S)?.status).toBe('already');
    expect(JSON.parse(store.getItem(S)!).map((s: { name: string }) => s.name)).toEqual(['Ava', 'Ben']);

    await store.disablePasscode('passcode1');
    expect(store.isPasscodeEnabled()).toBe(false);
    expect((await idb.getAllRecords('students')).every(r => !r.v.startsWith('enc1:'))).toBe(true);
  }, 30000);

  it('makes every row plaintext before the key is removed, so the lists open afterwards without it', async () => {
    await store.disablePasscode('passcode1');
    const rows = await allRows();
    expect(rows.students.map(r => JSON.parse(r.v).name)).toEqual(['Ava', 'Ben']);
    await load(rows);
    storage.setItem(MIGRATION_FLAG_KEY, JSON.stringify({ [S]: true }));
    const results = await dataStore.hydrateLists(keys);
    expect(results.find(r => r.key === S)?.status).toBe('already');
  }, 30000);

  it('is refused while a list is damaged, and nothing changes', async () => {
    await idb.putRecords('students', [{ k: 's1', v: 'enc1:damaged', o: 0 }]);
    await load(await allRows());
    expect(await store.unlock('passcode1')).toBe(true);
    await dataStore.hydrateLists(keys);
    expect(store.isUndecryptable(S)).toBe(true);
    await expect(store.disablePasscode('passcode1')).rejects.toThrow(/can't be turned off while some data can't be read \(Students\)/);
    expect(store.isPasscodeEnabled()).toBe(true);
    // The intact row is still encrypted under a key that the stored configuration can still unwrap.
    const ben = (await idb.getAllRecords('students')).find(r => r.k === 's2')!;
    expect(ben.v.startsWith('enc1:')).toBe(true);
  }, 30000);
});

it('a recovery key made after upgrading from the first passcode version also opens rows not saved since', async () => {
  // A first-version install: data encrypted directly with the passcode key (no wrapped data key yet).
  const enc = new TextEncoder();
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', enc.encode('passcode1'), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const encrypt = async (text: string) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, enc.encode(text)));
    const out = new Uint8Array(12 + data.length);
    out.set(iv);
    out.set(data, 12);
    return `enc1:${b64(out)}`;
  };
  storage.setItem(CONFIG_KEY, JSON.stringify({ v: 1, salt: b64(salt), iterations: 600000, check: await encrypt(store.CHECK_TEXT) }));
  await load({ students: [{ k: 's1', v: await encrypt('{"id":"s1","name":"Ava"}'), o: 0 }] });
  storage.setItem(MIGRATION_FLAG_KEY, JSON.stringify({ [S]: true }));
  expect(await store.unlock('passcode1')).toBe(true);
  await dataStore.hydrateLists({ students: S, templates: null, sessions: null });
  const recoveryKey = await store.createRecoveryKey();

  // The passcode is forgotten: reset it with the recovery key on a fresh start.
  await load(await allRows());
  await store.resetPasscodeWithRecoveryKey(recoveryKey, 'passcode2');
  const results = await dataStore.hydrateLists({ students: S, templates: null, sessions: null });
  expect(results[0].status).toBe('already');
  expect(store.getItem(S)).toContain('Ava');
}, 60000);

describe('a read that fails (not damaged data)', () => {
  beforeEach(async () => {
    storage.setItem(S, JSON.stringify([{ id: 's1', name: 'Ava' }]));
    await dataStore.hydrateLists(keys);
    await load(await allRows());
  });

  it('is retried, and a brief failure loads normally', async () => {
    idb.setIndexedDbReadFailures(1);
    const results = await dataStore.hydrateLists(keys);
    expect(results.find(r => r.key === S)?.status).toBe('already');
    expect(store.getItem(S)).toContain('Ava');
  });

  it('that keeps failing is reported as "reopen the app", protected from saves, and not marked damaged', async () => {
    idb.setIndexedDbReadFailures(3);
    const results = await dataStore.hydrateLists(keys);
    expect(results.find(r => r.key === S)?.status).toBe('read-failed');
    expect(store.isListReadFailed(S)).toBe(true);
    expect(store.isUndecryptable(S)).toBe(true); // never written over this visit
    // Opened again: it reads normally.
    await load(await allRows());
    const again = await dataStore.hydrateLists(keys);
    expect(again.find(r => r.key === S)?.status).toBe('already');
  });
});

describe('a save warning is cleared only once the save is stored', () => {
  const DRAFT = 'ascended_data_entry_draft_v1_u';

  it('runs straight away when nothing is pending, after a background write that succeeds, and not after one that fails', async () => {
    const ran: string[] = [];
    store.afterStored(DRAFT, () => ran.push('idle'));
    expect(ran).toEqual(['idle']);

    await store.enablePasscode('passcode1');
    store.setItem(DRAFT, '{"a":1}'); // protection on: written in the background
    store.afterStored(DRAFT, () => ran.push('stored'));
    await store.flushWrites();
    expect(ran).toEqual(['idle', 'stored']);

    // localStorage refuses the background write (storage full).
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (k === DRAFT) throw new DOMException('full', 'QuotaExceededError');
      setItem(k, v);
    };
    store.setItem(DRAFT, '{"a":2}');
    store.afterStored(DRAFT, () => ran.push('failed-but-ran'));
    await store.flushWrites().catch(() => {});
    await new Promise(r => setTimeout(r, 0));
    expect(ran).toEqual(['idle', 'stored']);
  }, 30000);
});
