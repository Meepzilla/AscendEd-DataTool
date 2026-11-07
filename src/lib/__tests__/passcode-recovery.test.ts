import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import { CHECK_TEXT } from '../secure-store';

// Finding 18: a forgotten passcode, and a single damaged list blocking passcode removal.
// The data key is wrapped under the passcode key (and under a recovery key when one is set
// up), so the passcode can change or be recovered without re-encrypting the data, and a
// damaged list is quarantined instead of blocking change/disable.
//
// A v1 install (data encrypted directly under the passcode key, as shipped before) is built
// here with raw WebCrypto, not with the module under test, so the migration test proves the
// new code can read what the old code wrote.

const S = 'ascended_students_v2_u';
const SE = 'ascended_sessions_v2_u';
const T = 'ascended_goal_templates_v2_u';
const D = 'ascended_data_entry_draft_v1_u';
const G = 'ascended_student_groups_v1_u';
const A = 'ascended_abc_lists';
const CONFIG_KEY = 'ascended_passcode_v1';
const MIGRATION_FLAG_KEY = 'ascended_idb_migrated_v1';
const ITERATIONS = 600_000;

let storage: ReturnType<typeof memoryStorage>;
let store: typeof import('../secure-store');

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

async function v1Key(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function encryptWithKey(k: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(text)));
  const all = new Uint8Array(12 + data.length);
  all.set(iv);
  all.set(data, 12);
  return 'enc1:' + b64(all);
}

async function decryptWithKey(k: CryptoKey, stored: string): Promise<string> {
  const all = unb64(stored.slice('enc1:'.length));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, k, all.subarray(12));
  return new TextDecoder().decode(plain);
}

/** Writes a v1 passcode install (config + encrypted localStorage values) into storage. Returns the old passcode key. */
async function installV1(passcode: string, values: Record<string, string>): Promise<CryptoKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await v1Key(passcode, salt);
  storage.setItem(CONFIG_KEY, JSON.stringify({
    v: 1, salt: b64(salt), iterations: ITERATIONS, check: await encryptWithKey(kek, CHECK_TEXT),
  }));
  for (const [k, v] of Object.entries(values)) storage.setItem(k, await encryptWithKey(kek, v));
  return kek;
}

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
  vi.resetModules();
  store = await import('../secure-store');
});

describe('recovery key', () => {
  it('generates a key in the shown format, and typing it back loosely still works', () => {
    const key = store.generateRecoveryKey();
    expect(key).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(store.generateRecoveryKey()).not.toBe(key);
    expect(store.normalizeRecoveryKey(key.toLowerCase().replace(/-/g, ' '))).toBe(key.replace(/-/g, ''));
    expect(store.normalizeRecoveryKey('not a key')).toBeNull();
    expect(store.normalizeRecoveryKey(key.slice(0, 10))).toBeNull();
  });

  it('unlocks with the recovery key after the passcode is forgotten', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    const recoveryKey = store.generateRecoveryKey();
    await store.enablePasscode('passcode1', 15, recoveryKey);
    expect(store.hasRecoveryKey()).toBe(true);

    vi.resetModules();
    const fresh = await import('../secure-store');
    expect(await fresh.unlock('passcode1')).toBe(true);
    expect(fresh.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');

    // The passcode is forgotten: a fresh load, wrong passcode guesses, then the recovery key.
    vi.resetModules();
    const locked = await import('../secure-store');
    expect(await locked.unlock('wrong-pass')).toBe(false);
    expect(await locked.unlockWithRecoveryKey('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA')).toBe(false);
    // Typed loosely (lowercase, no dashes) it still opens.
    expect(await locked.unlockWithRecoveryKey(recoveryKey.toLowerCase().replace(/-/g, ''))).toBe(true);
    expect(locked.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');

    // The passcode still works afterwards: recovery did not replace it.
    vi.resetModules();
    const again = await import('../secure-store');
    expect(await again.unlock('passcode1')).toBe(true);
    expect(again.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
  }, 30000);

  it('resets the passcode with the recovery key, and the recovery key keeps working', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    const recoveryKey = store.generateRecoveryKey();
    await store.enablePasscode('passcode1', 15, recoveryKey);

    vi.resetModules();
    const locked = await import('../secure-store');
    const { quarantined } = await locked.resetPasscodeWithRecoveryKey(recoveryKey, 'newpass99');
    expect(quarantined).toEqual([]);
    expect(locked.isUnlocked()).toBe(true);
    expect(locked.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');

    vi.resetModules();
    const again = await import('../secure-store');
    expect(await again.unlock('newpass99')).toBe(true);
    expect(await again.unlock('passcode1')).toBe(false);
    expect(await again.unlockWithRecoveryKey(recoveryKey)).toBe(true);
  }, 30000);

  it('refuses a wrong recovery key, and a made-up one when none is set up', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    await store.enablePasscode('passcode1');
    expect(store.hasRecoveryKey()).toBe(false);
    const recoveryKey = store.generateRecoveryKey();
    expect(await store.unlockWithRecoveryKey(recoveryKey)).toBe(false);
    await expect(store.resetPasscodeWithRecoveryKey(recoveryKey, 'newpass99')).rejects.toThrow('No recovery key');
  }, 20000);
});

describe('migration of an existing passcode install', () => {
  it('migrates localStorage lists to the wrapped-key scheme on unlock, without losing data', async () => {
    const kek = await installV1('passcode1', { [S]: '[{"id":"s1","name":"Ava"}]', [D]: 'draft' });
    const storedBefore = storage.getItem(S)!;

    expect(await store.unlock('passcode1')).toBe(true);
    expect(store.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
    expect(store.getItem(D)).toBe('draft');
    // The config is v2 now, and the stored value is no longer under the old passcode key.
    const config = JSON.parse(storage.getItem(CONFIG_KEY)!);
    expect(config.v).toBe(2);
    expect(typeof config.wrappedDek).toBe('string');
    expect(storage.getItem(S)).not.toBe(storedBefore);
    await expect(decryptWithKey(kek, storage.getItem(S)!)).rejects.toThrow();

    // A fresh load unlocks with the same passcode, through the wrapped key.
    vi.resetModules();
    const fresh = await import('../secure-store');
    expect(await fresh.unlock('passcode1')).toBe(true);
    expect(fresh.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
    expect(fresh.hasRecoveryKey()).toBe(false);

    // A recovery key can now be set up from Settings, and it unlocks the migrated data.
    const recoveryKey = await fresh.createRecoveryKey();
    expect(fresh.hasRecoveryKey()).toBe(true);
    vi.resetModules();
    const locked = await import('../secure-store');
    expect(await locked.unlockWithRecoveryKey(recoveryKey)).toBe(true);
    expect(locked.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
  }, 30000);

  it('migrates IndexedDB rows still under the old passcode key when the passcode changes', async () => {
    const idb = await import('../indexed-db-store');
    idb.useMemoryIndexedDb();
    idb.resetMemoryIndexedDb();
    const kek = await installV1('passcode1', {});
    const students = '[{"id":"s1","name":"Ava"}]';
    const sessions = '[{"sessionId":"se1","studentId":"s1"}]';
    await idb.putRecords('students', [{ k: 's1', v: await encryptWithKey(kek, '{"id":"s1","name":"Ava"}'), o: 0 }]);
    await idb.putRecords('sessions', [{ k: 'se1', v: await encryptWithKey(kek, '{"sessionId":"se1","studentId":"s1"}'), o: 0 }]);
    storage.setItem(MIGRATION_FLAG_KEY, JSON.stringify({ [S]: true, [SE]: true }));

    expect(await store.unlock('passcode1')).toBe(true);
    const dataStore = await import('../data-store');
    await dataStore.hydrateLists({ students: S, templates: null, sessions: SE });
    expect(store.getItem(S)).toBe(students);
    expect(store.getItem(SE)).toBe(sessions);

    await store.changePasscode('passcode1', 'passcode2');
    // The rows are under the data key now: the old passcode key no longer opens them.
    const rows = await idb.getAllRecords('students');
    expect(rows).toHaveLength(1);
    await expect(decryptWithKey(kek, rows[0].v)).rejects.toThrow();
    expect(await store.unlock('passcode2')).toBe(true);
    expect(await store.readDurableList(S)).toEqual([{ id: 's1', name: 'Ava' }]);
    expect(await store.readDurableList(SE)).toEqual([{ sessionId: 'se1', studentId: 's1' }]);
  }, 30000);
});

describe('damaged-list quarantine', () => {
  it('change proceeds with one damaged list: the damaged list stays byte-identical, readable lists convert', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    storage.setItem(D, 'draft');
    await store.enablePasscode('passcode1');
    storage.setItem(D, 'enc1:damaged-data');
    expect(await store.unlock('passcode1')).toBe(true);
    expect(store.isUndecryptable(D)).toBe(true);

    const { quarantined } = await store.changePasscode('passcode1', 'passcode2');
    expect(quarantined).toEqual([{ key: D, label: 'Data Entry draft' }]);
    expect(storage.getItem(D)).toBe('enc1:damaged-data');
    expect(store.isUndecryptable(D)).toBe(true);

    vi.resetModules();
    const fresh = await import('../secure-store');
    expect(await fresh.unlock('passcode2')).toBe(true);
    expect(fresh.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
    expect(fresh.isUndecryptable(D)).toBe(true);
    expect(storage.getItem(D)).toBe('enc1:damaged-data');
  }, 30000);

  it('disable is refused while groups or ABC lists are damaged: removing the key would lose them, so nothing changes', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    storage.setItem(G, '[{"id":"g1","name":"Room 12","studentIds":["s1"]}]');
    storage.setItem(A, '{"antecedents":["Asked to wait"],"behaviors":[],"consequences":[]}');
    await store.enablePasscode('passcode1');
    storage.setItem(G, 'enc1:damaged-groups');
    storage.setItem(A, 'enc1:damaged-abc');
    expect(await store.unlock('passcode1')).toBe(true);
    expect(store.isUndecryptable(G)).toBe(true);
    expect(store.isUndecryptable(A)).toBe(true);
    const studentsBefore = storage.getItem(S);

    await expect(store.disablePasscode('passcode1')).rejects.toThrow(/can't be turned off while some data can't be read \(.*Student groups.*\)/);
    // Protection stays on and nothing is rewritten: the damaged values, the students and the key are as they were.
    expect(store.isPasscodeEnabled()).toBe(true);
    expect(storage.getItem(G)).toBe('enc1:damaged-groups');
    expect(storage.getItem(A)).toBe('enc1:damaged-abc');
    expect(storage.getItem(S)).toBe(studentsBefore);
    expect(store.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
  }, 30000);

  it('change proceeds with a damaged IndexedDB list: its rows stay byte-identical, readable lists convert', async () => {
    const idb = await import('../indexed-db-store');
    idb.useMemoryIndexedDb();
    idb.resetMemoryIndexedDb();
    await store.enablePasscode('passcode1');
    const dataStore = await import('../data-store');
    await dataStore.hydrateLists({ students: S, templates: null, sessions: SE });
    await store.setItemAsync(S, '[{"id":"s1","name":"Ava"},{"id":"s2","name":"Ben"}]');
    await store.setItemAsync(SE, '[{"sessionId":"se1","studentId":"s1"}]');
    const rowsBefore = await idb.getAllRecords('students');
    expect(rowsBefore).toHaveLength(2);
    // Damage one row of the students list; the sessions list stays readable.
    await idb.putRecords('students', [{ k: 's1', v: 'enc1:damaged', o: 0 }]);

    expect(await store.unlock('passcode1')).toBe(true);
    await dataStore.hydrateLists({ students: S, templates: null, sessions: SE });
    expect(store.isUndecryptable(S)).toBe(true);

    const { quarantined } = await store.changePasscode('passcode1', 'passcode2');
    expect(quarantined).toEqual([{ key: S, label: 'Students' }]);
    const rowsAfter = await idb.getAllRecords('students');
    expect(rowsAfter).toHaveLength(2);
    expect(rowsAfter[0].v).toBe('enc1:damaged');
    expect(rowsAfter[1].v).toBe(rowsBefore[1].v);
    expect(store.isUndecryptable(S)).toBe(true);

    expect(await store.unlock('passcode2')).toBe(true);
    expect(await store.readDurableList(SE)).toEqual([{ sessionId: 'se1', studentId: 's1' }]);
  }, 30000);
});

describe('recovery lockout', () => {
  it('a passcode lockout does not block recovery, and recovery guesses do not block the passcode', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    const recoveryKey = store.generateRecoveryKey();
    await store.enablePasscode('passcode1', 15, recoveryKey);

    // Five wrong passcodes lock the passcode out, but the recovery key still opens.
    for (let i = 0; i < 5; i++) expect(await store.unlock('wrong-pass')).toBe(false);
    expect(await store.unlock('passcode1')).toBe(false);
    expect(await store.unlockWithRecoveryKey(recoveryKey)).toBe(true);
    expect(store.getItem(S)).toBe('[{"id":"s1","name":"Ava"}]');
  }, 30000);

  it('repeated wrong recovery keys lock recovery out, while the passcode still works', async () => {
    storage.setItem(S, '[{"id":"s1","name":"Ava"}]');
    const recoveryKey = store.generateRecoveryKey();
    const wrongKey = store.generateRecoveryKey();
    expect(wrongKey).not.toBe(recoveryKey);
    await store.enablePasscode('passcode1', 15, recoveryKey);

    for (let i = 0; i < 5; i++) expect(await store.unlockWithRecoveryKey(wrongKey)).toBe(false);
    expect(await store.unlockWithRecoveryKey(recoveryKey)).toBe(false);
    expect(await store.unlock('passcode1')).toBe(true);
  }, 30000);
});
