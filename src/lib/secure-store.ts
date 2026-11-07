// Passcode protection: student data (students, sessions and unsaved Data Entry work) is stored encrypted on the
// device, readable only after the passcode is entered.
//
// - The passcode is never stored. A key is derived from it (PBKDF2-SHA-256, 600,000 rounds, random salt) and
//   used for AES-256-GCM. Only the salt and a small encrypted check value are kept, to tell a right passcode
//   from a wrong one.
// - After unlocking, the decrypted data is held in memory for the app (which reads and writes storage
//   synchronously); each write is encrypted and stored, in order. Locking reloads the page,
//   which clears the memory and the key.
// - Without protection, everything works as before (plain storage).
//
// Durability: a write is not reported as saved until it has landed. setItemAsync resolves only after the
// value is in durable storage and read back, and flushWrites throws when a background write failed, so
// callers can roll back instead of showing success for data that never reached disk. The synchronous
// setItem is kept for fire-and-forget writes (the Data Entry draft) only; committed data uses setItemAsync.
//
// Storage backend: the three main lists (students, goal templates, sessions) live as per-record rows in
// IndexedDB (see indexed-db-store.ts), one row per record, each record encrypted the same way as before
// when protection is on (templates were never encrypted and stay plaintext, as before). Other keys, and
// lists that have not migrated yet (a corrupt localStorage blob is never migrated), stay in localStorage.
// The in-memory cache is still the synchronous read path: it is filled from IndexedDB by hydrateLists
// (data-store.ts) when the app loads, before anything reads a list.
//
// A forgotten passcode can't be recovered: the data can only be erased and restored from a backup.

import { isLockedOut, recordAttempt } from './attempt-lockout';
import * as idb from './indexed-db-store';

const CONFIG_KEY = 'ascended_passcode_v1';
const ITERATIONS = 600_000;
const PREFIX = 'enc1:';
const CHECK_TEXT = 'ascended-passcode-check';
const SPACE_CHECK_KEY = '__ascended_space_check';
/** localStorage key holding { [storageKey]: true } for lists already moved to IndexedDB. */
const MIGRATION_FLAG_KEY = 'ascended_idb_migrated_v1';
/** localStorage key set by eraseProtectedData so a reload ignores IndexedDB rows even if it lands first. */
const ERASED_KEY = 'ascended_idb_erased_v1';
export const MIN_PASSCODE_LENGTH = 6;

/** Keys holding student data. Templates and display settings aren't student data and stay as they are. */
const SENSITIVE = /^ascended_(students_v2|sessions_v2|data_entry_draft_v1)_/;
export const isSensitiveKey = (key: string) => SENSITIVE.test(key);

/** The three main lists, whatever their backend: base key, IndexedDB store, id field. */
const LIST_KEYS = [
  { base: 'ascended_students_v2', store: idb.LIST_STORES.students, idField: 'id' },
  { base: 'ascended_goal_templates_v2', store: idb.LIST_STORES.goalTemplates, idField: 'id' },
  { base: 'ascended_sessions_v2', store: idb.LIST_STORES.sessions, idField: 'sessionId' },
] as const;

export const isListKey = (key: string) => LIST_KEYS.some(({ base }) => key.startsWith(`${base}_`));

function listKeyInfo(key: string) {
  return LIST_KEYS.find(({ base }) => key.startsWith(`${base}_`)) ?? null;
}

export function listStoreName(key: string): idb.ListStoreName | null {
  return listKeyInfo(key)?.store ?? null;
}

/** Which backend each list key writes to (decided once, then kept). */
const listBackends = new Map<string, 'idb' | 'localstorage'>();
/** List keys whose cache has been filled from durable storage by hydrateLists. */
const hydratedLists = new Set<string>();
/** Last persisted size in bytes per list key (for the storage-size estimate). */
const persistedBytes = new Map<string, number>();

function migrationFlags(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(MIGRATION_FLAG_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

function setMigrationFlag(key: string, migrated: boolean) {
  try {
    const flags = migrationFlags();
    if (migrated) flags[key] = true;
    else delete flags[key];
    localStorage.setItem(MIGRATION_FLAG_KEY, JSON.stringify(flags));
  } catch {
    // The flag is a hint; the backend map above is what the running app uses.
  }
}

/**
 * Which backend a list key writes to. A flagged list is in IndexedDB; anything else is still in
 * localStorage until hydrateLists migrates it. Without IndexedDB at all, everything stays local.
 */
export function getListBackend(key: string): 'idb' | 'localstorage' {
  const known = listBackends.get(key);
  if (known) return known;
  let backend: 'idb' | 'localstorage' = 'localstorage';
  if (typeof window !== 'undefined' && idb.isIndexedDbSupported() && migrationFlags()[key]) backend = 'idb';
  listBackends.set(key, backend);
  return backend;
}

export function setListBackend(key: string, backend: 'idb' | 'localstorage') {
  listBackends.set(key, backend);
  setMigrationFlag(key, backend === 'idb');
}

export function isListHydrated(key: string) {
  return hydratedLists.has(key);
}

export function markListHydrated(key: string) {
  hydratedLists.add(key);
}

/** Whether eraseProtectedData has run since the last load (see hydrateLists). */
export function isEraseMarkerSet(): boolean {
  try {
    return localStorage.getItem(ERASED_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearEraseMarker() {
  try {
    localStorage.removeItem(ERASED_KEY);
  } catch {
    /* nothing stored */
  }
}

/** The cache value for a list key, for hydrateLists to fill after reading durable storage. */
export function setCachedValue(key: string, value: string | null) {
  cache.set(key, value);
}

export function getCachedValue(key: string): string | null | undefined {
  return cache.get(key);
}

/** Marks a list unreadable (a record in it could not be decrypted): it is never written over. */
export function markListUndecryptable(key: string) {
  undecryptable.add(key);
  cache.set(key, '\u0000damaged');
}

/** Bytes this key last persisted (IndexedDB lists) or holds now (localStorage keys). */
export function getCurrentKeyBytes(key: string): number {
  if (isListKey(key) && getListBackend(key) === 'idb') return persistedBytes.get(key) ?? 0;
  try {
    return localStorage.getItem(key)?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Bytes held in IndexedDB list rows (for the storage-size fallback estimate). */
export function getPersistedListBytes(): number {
  return [...persistedBytes.values()].reduce((sum, n) => sum + n, 0);
}

interface PasscodeConfig { v: 1; salt: string; iterations: number; check: string; autoLockMinutes?: number }

let key: CryptoKey | null = null;
const cache = new Map<string, string | null>();
const writing = new Map<string, Promise<void>>();
const dirty = new Set<string>();
/** Stored student-data values that couldn't be decrypted at unlock (damaged); they are left as stored. */
const undecryptable = new Set<string>();
let onWriteError: ((error: unknown) => void) | null = null;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const b64Chunked = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

function readConfig(): PasscodeConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPasscodeEnabled(): boolean {
  return typeof window !== 'undefined' && !!readConfig();
}
export function isUnlocked(): boolean {
  return !isPasscodeEnabled() || key !== null;
}
export function getAutoLockMinutes(): number {
  return readConfig()?.autoLockMinutes ?? 15;
}
export function setAutoLockMinutes(minutes: number) {
  const config = readConfig();
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...config, autoLockMinutes: minutes }));
}
/** Called when a background write fails (e.g. storage full), so the app can say so. */
export function setWriteErrorHandler(handler: ((error: unknown) => void) | null) {
  onWriteError = handler;
}

async function deriveKey(passcode: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptWith(k: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)));
  const all = new Uint8Array(iv.length + data.length);
  all.set(iv);
  all.set(data, iv.length);
  return PREFIX + b64Chunked(all);
}

async function decryptWith(k: CryptoKey, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) throw new Error('Not encrypted');
  const all = unb64(stored.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, k, all.subarray(12));
  return new TextDecoder().decode(plain);
}

/**
 * Encrypts one stored string with the current key, exactly as the whole-blob path did: sensitive keys
 * (students, sessions) are encrypted when protection is on, everything else (templates were never
 * encrypted) is stored as it is.
 */
export async function encryptStoredValue(storageKey: string, text: string): Promise<string> {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) throw new Error('Locked');
    return encryptWith(key, text);
  }
  return text;
}

/** Decrypts one stored string; throws when it is encrypted and the key is wrong or missing. */
export async function decryptStoredValue(storageKey: string, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!isSensitiveKey(storageKey) || !key) throw new Error('Locked');
  return decryptWith(key, stored);
}

/** JSON with object keys sorted, so the same value always compares equal whatever its key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(k => record[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

/** The stored length of a value once encrypted (prefix + base64 of IV, ciphertext and tag). */
const encryptedLength = (text: string) => PREFIX.length + Math.ceil((12 + new TextEncoder().encode(text).length + 16) / 3) * 4;

/** Whether replacing `key`'s stored value with one `newLength` long fits in storage (checked synchronously). */
function fits(storageKey: string, newLength: number): boolean {
  const extra = newLength - (localStorage.getItem(storageKey)?.length ?? 0);
  if (extra <= 0) return true;
  try {
    localStorage.setItem(SPACE_CHECK_KEY, 'x'.repeat(extra));
    localStorage.removeItem(SPACE_CHECK_KEY);
    return true;
  } catch {
    try { localStorage.removeItem(SPACE_CHECK_KEY); } catch { /* nothing stored */ }
    return false;
  }
}

/**
 * Writes one list's cached JSON to IndexedDB as per-record rows (encrypting each record the same way the
 * blob was encrypted), deletes rows for records that are gone, and reads the rows back to verify the
 * write landed as written. Throws on any failure, including a verification mismatch. A null cached
 * value clears the store.
 */
async function persistListRecords(storageKey: string): Promise<void> {
  const info = listKeyInfo(storageKey);
  if (!info) throw new Error(`Not a list key: ${storageKey}`);
  // A damaged value put back as it was stored (restoreItem) is left alone.
  if (undecryptable.has(storageKey)) return;
  const value = cache.get(storageKey);
  if (value === null || value === undefined) {
    await idb.clearStore(info.store);
    persistedBytes.delete(storageKey);
    return;
  }
  let records: unknown;
  try {
    records = JSON.parse(value);
  } catch {
    throw new Error('Cannot save: the stored data is not valid JSON.');
  }
  if (!Array.isArray(records)) throw new Error('Cannot save: the stored data is not a list.');
  const previousIds = new Set<string>();
  const rows: idb.IdRecord[] = [];
  let bytes = 0;
  for (let i = 0; i < records.length; i++) {
    const record = records[i] as Record<string, unknown>;
    const id = typeof record === 'object' && record !== null ? record[info.idField] : undefined;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('Cannot save: a record without an id cannot be stored.');
    }
    previousIds.add(id);
    const stored = await encryptStoredValue(storageKey, JSON.stringify(record));
    bytes += stored.length + id.length;
    rows.push({ k: id, v: stored, o: i });
  }
  const lastIds = new Set<string>();
  for (const row of await idb.getAllRecords(info.store)) lastIds.add(row.k);
  await idb.putRecords(info.store, rows);
  const stale = [...lastIds].filter(id => !previousIds.has(id));
  if (stale.length) await idb.deleteRecords(info.store, stale);
  // Verify: read the rows back and compare each record with what was written.
  const back = await idb.getAllRecords(info.store);
  if (back.length !== records.length) throw new Error('Save verification failed: the stored records do not match.');
  for (let i = 0; i < back.length; i++) {
    const readBack = await decryptStoredValue(storageKey, back[i].v);
    if (readBack !== JSON.stringify(records[i])) throw new Error('Save verification failed: a stored record does not match.');
  }
  persistedBytes.set(storageKey, bytes);
}

/** Waits until no write is pending for the key (including one re-queued while waiting). Throws if it failed. */
async function awaitPersisted(storageKey: string): Promise<void> {
  while (writing.has(storageKey)) {
    await writing.get(storageKey)!;
  }
}

function persist(storageKey: string) {
  if (writing.has(storageKey)) { dirty.add(storageKey); return; }
  const run = (async () => {
    try {
      if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
        await persistListRecords(storageKey);
      } else {
        const value = cache.get(storageKey);
        const stored = value === null || value === undefined ? null : await encryptWith(key!, value);
        // A damaged value put back as it was stored (restoreItem) is left alone.
        if (undecryptable.has(storageKey)) return;
        if (stored === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, stored);
      }
    } catch (error) {
      // A failed write is reported and the write promise rejects, so flushWrites throws on it and
      // setItemAsync (which awaits the same write) rejects: no caller can report success for it.
      onWriteError?.(error);
      throw error;
    }
  })().finally(() => {
    writing.delete(storageKey);
    if (dirty.delete(storageKey)) persist(storageKey);
  });
  writing.set(storageKey, run);
  // A queued background write nobody awaits must not surface as an unhandled rejection; callers that
  // do await it (setItemAsync, flushWrites) still see the failure.
  void run.catch(() => {});
}

// ---- Storage access used by the app (same shape as localStorage) ----

/** Reads a stored value. Student data comes from memory (decrypted at unlock) when protection is on. */
export function getItem(storageKey: string): string | null {
  if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
    // IndexedDB lists have no localStorage blob to read: the cache (filled by hydrateLists) is the read path.
    if (isSensitiveKey(storageKey) && isPasscodeEnabled() && !key) return null;
    return cache.get(storageKey) ?? null;
  }
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) return null;
    return cache.get(storageKey) ?? null;
  }
  return localStorage.getItem(storageKey);
}

/**
 * Stores a value. With protection on, student data is kept in memory and encrypted into storage in the
 * background; whether it fits is checked first, so a full storage throws here as localStorage would.
 * This is fire-and-forget: it returns before the write lands. Committed data must use setItemAsync.
 */
export function setItem(storageKey: string, value: string) {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) throw new Error('Locked');
    if (!(isListKey(storageKey) && getListBackend(storageKey) === 'idb') && !fits(storageKey, encryptedLength(value))) {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    }
    undecryptable.delete(storageKey); // replaced with readable data
    cache.set(storageKey, value);
    persist(storageKey);
    return;
  }
  if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
    undecryptable.delete(storageKey);
    cache.set(storageKey, value);
    persist(storageKey);
    return;
  }
  localStorage.setItem(storageKey, value);
}

/**
 * Stores a value and resolves only after it has landed in durable storage and read back. Throws
 * (QuotaExceededError when storage is full, or the verification error) when it did not land, so the
 * caller must not update state or report success.
 */
export async function setItemAsync(storageKey: string, value: string): Promise<void> {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) throw new Error('Locked');
    if (!(isListKey(storageKey) && getListBackend(storageKey) === 'idb') && !fits(storageKey, encryptedLength(value))) {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    }
    undecryptable.delete(storageKey);
    cache.set(storageKey, value);
    persist(storageKey);
    await awaitPersisted(storageKey);
    return;
  }
  if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
    undecryptable.delete(storageKey);
    cache.set(storageKey, value);
    persist(storageKey);
    await awaitPersisted(storageKey);
    return;
  }
  localStorage.setItem(storageKey, value);
}

export function removeItem(storageKey: string) {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    undecryptable.delete(storageKey);
    cache.set(storageKey, null);
    persist(storageKey);
    return;
  }
  if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
    cache.set(storageKey, null);
    persist(storageKey);
    return;
  }
  localStorage.removeItem(storageKey);
}

/** Removes a value and resolves only after the removal has landed. */
export async function removeItemAsync(storageKey: string): Promise<void> {
  if ((isSensitiveKey(storageKey) && isPasscodeEnabled()) || (isListKey(storageKey) && getListBackend(storageKey) === 'idb')) {
    if (isSensitiveKey(storageKey) && isPasscodeEnabled() && !key) throw new Error('Locked');
    undecryptable.delete(storageKey);
    cache.set(storageKey, null);
    persist(storageKey);
    await awaitPersisted(storageKey);
    return;
  }
  localStorage.removeItem(storageKey);
}

export function isUndecryptable(storageKey: string) {
  return undecryptable.has(storageKey);
}

/** A stored value as it is, to put back with restoreItem (damaged values exactly as stored, not as read). */
export type ItemSnapshot = { damaged: boolean; value: string | null };
export function snapshotItem(storageKey: string): ItemSnapshot {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled() && undecryptable.has(storageKey)) {
    return { damaged: true, value: localStorage.getItem(storageKey) };
  }
  return { damaged: false, value: getItem(storageKey) };
}
/** Puts back a value taken with snapshotItem. */
export function restoreItem(storageKey: string, snapshot: ItemSnapshot) {
  if (snapshot.damaged) {
    // Back to the damaged value as stored: pending writes of the newer value skip it (see persist).
    undecryptable.add(storageKey);
    cache.set(storageKey, '\u0000damaged');
    if (snapshot.value === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, snapshot.value);
    return;
  }
  if (snapshot.value === null) removeItem(storageKey);
  else setItem(storageKey, snapshot.value);
}

/** Puts back a value taken with snapshotItem, resolving only after it has landed. */
export async function restoreItemAsync(storageKey: string, snapshot: ItemSnapshot): Promise<void> {
  if (snapshot.damaged) {
    restoreItem(storageKey, snapshot);
    return;
  }
  if (snapshot.value === null) await removeItemAsync(storageKey);
  else await setItemAsync(storageKey, snapshot.value);
}

/**
 * Reads one list back from durable storage (IndexedDB rows, or the localStorage blob), bypassing the
 * in-memory cache, so verification sees what is actually stored. Undefined when it cannot be read.
 */
export async function readDurableList(storageKey: string): Promise<unknown[] | undefined> {
  try {
    if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
      const info = listKeyInfo(storageKey)!;
      const rows = await idb.getAllRecords(info.store);
      const values: unknown[] = [];
      for (const row of rows) values.push(JSON.parse(await decryptStoredValue(storageKey, row.v)));
      return values;
    }
    let item: string | null;
    if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return [];
      item = await decryptStoredValue(storageKey, raw);
    } else {
      item = localStorage.getItem(storageKey);
    }
    if (item === null) return [];
    const parsed: unknown = JSON.parse(item);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a list's durable storage holds exactly the expected records (order-insensitive by key order). */
export async function verifyStoredList(storageKey: string, expected: unknown): Promise<boolean> {
  const durable = await readDurableList(storageKey);
  if (durable === undefined) return false;
  return stableStringify(durable) === stableStringify(expected);
}

/** Waits until every background write has been stored. Throws when any of them failed. */
export async function flushWrites() {
  while (writing.size) {
    const settled = await Promise.allSettled([...writing.values()]);
    const failed = settled.find(r => r.status === 'rejected');
    if (failed) throw (failed as PromiseRejectedResult).reason;
  }
}

/** Clears all three IndexedDB list stores and the migration flag (Delete All Data). */
export async function deleteAllListData(): Promise<void> {
  await idb.clearAllListStores();
  try {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  } catch {
    /* nothing stored */
  }
  listBackends.clear();
  hydratedLists.clear();
  persistedBytes.clear();
}

const sensitiveKeysInStorage = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSensitiveKey(k)) keys.push(k);
  }
  return keys;
};

// ---- Passcode ----

/** The key for the passcode, or null if it is wrong. */
async function keyFor(passcode: string, config: PasscodeConfig): Promise<CryptoKey | null> {
  const candidate = await deriveKey(passcode, unb64(config.salt), config.iterations);
  try {
    return await decryptWith(candidate, config.check) === CHECK_TEXT ? candidate : null;
  } catch {
    return null;
  }
}

/** Unlocks with the passcode: true if it is right (the data is then decrypted into memory). */
export async function unlock(passcode: string): Promise<boolean> {
  const config = readConfig();
  if (!config) return true;
  // Locked out after repeated wrong passcodes: fail immediately, without recording another failure
  // (a locked-out attempt must not extend the lockout) and without deriving a key.
  if (isLockedOut('passcode')) return false;
  const candidate = await keyFor(passcode, config);
  if (!candidate) {
    recordAttempt('passcode', false);
    return false;
  }
  recordAttempt('passcode', true);
  cache.clear();
  undecryptable.clear();
  for (const storageKey of sensitiveKeysInStorage()) {
    const stored = localStorage.getItem(storageKey)!;
    try {
      cache.set(storageKey, await decryptWith(candidate, stored));
    } catch {
      // Left as stored; the app reports it as unreadable and doesn't write over it.
      undecryptable.add(storageKey);
      cache.set(storageKey, '\u0000damaged');
    }
  }
  key = candidate;
  return true;
}

async function newConfig(passcode: string, autoLockMinutes = 15): Promise<{ config: PasscodeConfig; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(passcode, salt, ITERATIONS);
  return { key: k, config: { v: 1, salt: b64(salt), iterations: ITERATIONS, check: await encryptWith(k, CHECK_TEXT), autoLockMinutes } };
}

/**
 * Writes the given student-data values, all or nothing (synchronously, so no other write can come between): if storage fills part way,
 * what was written is put back as it was.
 */
function rewriteAll(entries: [string, string][], configValue: string | null) {
  const previous = new Map<string, string | null>();
  try {
    for (const [storageKey, value] of entries) {
      previous.set(storageKey, localStorage.getItem(storageKey));
      localStorage.setItem(storageKey, value);
    }
    previous.set(CONFIG_KEY, localStorage.getItem(CONFIG_KEY));
    if (configValue === null) localStorage.removeItem(CONFIG_KEY);
    else localStorage.setItem(CONFIG_KEY, configValue);
  } catch (error) {
    previous.forEach((value, storageKey) => {
      try {
        if (value === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, value);
      } catch { /* it fit before */ }
    });
    throw error;
  }
}

/**
 * Encodes every value `read` gives (each key's current value) with `encode`. Encoding waits, and the app can
 * write meanwhile, so values that changed are encoded again until none have; the caller then stores the result
 * straight away (synchronously), so nothing written in between is lost.
 */
async function encodeCurrent(read: () => [string, string | null][], encode: (value: string) => Promise<string>, waitForWrites: boolean) {
  const done = new Map<string, { value: string; out: string }>();
  for (;;) {
    if (waitForWrites) await flushWrites();
    const changed = read().filter(([k, v]) => v !== null && done.get(k)?.value !== v) as [string, string][];
    if (!changed.length) break;
    for (const [k, v] of changed) done.set(k, { value: v, out: await encode(v) });
  }
  const current = new Map(read());
  return [...done].filter(([k, d]) => current.get(k) === d.value).map(([k, d]) => [k, d.out] as [string, string]);
}

/**
 * Re-encrypts every IndexedDB list with the current key (or stores it plaintext when protection is
 * off, after disablePasscode). Pending writes with the previous key finish first, so none lands after.
 */
async function reencryptIdbLists() {
  if (!idb.isIndexedDbSupported()) return;
  try {
    await flushWrites();
  } catch {
    // A failed pending write was already reported; re-encrypting what is in memory is still correct.
  }
  for (const storageKey of [...cache.keys()]) {
    if (!isListKey(storageKey) || getListBackend(storageKey) !== 'idb') continue;
    if (undecryptable.has(storageKey)) continue;
    await persistListRecords(storageKey);
  }
}

/** Turns protection on: encrypts the student data with a new passcode. */
export async function enablePasscode(passcode: string, autoLockMinutes = 15) {
  if (passcode.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  if (isPasscodeEnabled()) throw new Error('Passcode protection is already on.');
  const { config, key: k } = await newConfig(passcode, autoLockMinutes);
  const readStorage = () => sensitiveKeysInStorage().map(storageKey => [storageKey, localStorage.getItem(storageKey)] as [string, string | null]);
  const encrypted = await encodeCurrent(readStorage, value => encryptWith(k, value), false);
  const plain = readStorage();
  rewriteAll(encrypted, JSON.stringify(config));
  key = k;
  // Lists already in IndexedDB have no localStorage blob, so they are not in `plain`: keep their
  // in-memory values and re-encrypt their rows with the new key instead of dropping them.
  const listCache = [...cache].filter(([storageKey]) => isListKey(storageKey) && getListBackend(storageKey) === 'idb');
  cache.clear();
  plain.forEach(([storageKey, value]) => cache.set(storageKey, value));
  listCache.forEach(([storageKey, value]) => cache.set(storageKey, value));
  await reencryptIdbLists();
}

/** Checks the passcode for change/disable, without reloading the data the app is using. */
async function confirmPasscode(current: string, wrong: string) {
  const config = readConfig();
  if (!config) throw new Error('Passcode protection is off.');
  if (!key) {
    if (!(await unlock(current))) throw new Error(wrong);
  } else if (!(await keyFor(current, config))) {
    throw new Error(wrong);
  }
}

// IndexedDB lists are re-encrypted separately (see reencryptIdbLists): encoding them here would also
// write them back as localStorage blobs.
const cachedValues = () => [...cache].filter(([k]) => !undecryptable.has(k) && !(isListKey(k) && getListBackend(k) === 'idb'));

/** Changes the passcode (the data is re-encrypted). Needs the current passcode. */
export async function changePasscode(current: string, next: string) {
  if (next.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  await confirmPasscode(current, 'The current passcode is wrong.');
  if (undecryptable.size) throw new Error("Some saved data can't be read, so the passcode can't be changed. Restore a backup first.");
  const { config, key: k } = await newConfig(next, getAutoLockMinutes());
  // Pending writes (with the old key) are finished before the last check, so none land after the rewrite.
  const encrypted = await encodeCurrent(cachedValues, value => encryptWith(k, value), true);
  rewriteAll(encrypted, JSON.stringify(config));
  key = k;
  await reencryptIdbLists();
}

/** Turns protection off: the student data is stored unencrypted again. Needs the passcode. */
export async function disablePasscode(current: string) {
  await confirmPasscode(current, 'The passcode is wrong.');
  if (undecryptable.size) throw new Error("Some saved data can't be read, so protection can't be turned off. Restore a backup first.");
  const plain = await encodeCurrent(cachedValues, async value => value, true);
  rewriteAll(plain, null);
  // cache.clear() below would drop the IndexedDB lists (they have no localStorage value to restore
  // from), so keep them and store their rows unencrypted.
  const listCache = [...cache].filter(([storageKey]) => isListKey(storageKey) && getListBackend(storageKey) === 'idb');
  key = null;
  cache.clear();
  listCache.forEach(([storageKey, value]) => cache.set(storageKey, value));
  await reencryptIdbLists();
}

/** Forgotten passcode: erases the student data on this device and turns protection off. */
export function eraseProtectedData() {
  sensitiveKeysInStorage().forEach(storageKey => localStorage.removeItem(storageKey));
  localStorage.removeItem(CONFIG_KEY);
  // The IndexedDB rows are cleared in the background; the marker makes the next load ignore them even
  // if the reload lands first (see hydrateLists in data-store.ts).
  try {
    localStorage.setItem(ERASED_KEY, new Date().toISOString());
  } catch {
    /* nothing stored */
  }
  void deleteAllListData().catch(() => {});
  key = null;
  cache.clear();
}

/** Locks the app: waits for pending writes, then reloads, which clears the data and key from memory. */
export async function lockNow() {
  try {
    await flushWrites();
  } catch {
    // A failed write was already reported; reloading loses nothing more than the failed write did.
  }
  window.location.reload();
}

// ---- Password-protected files (backups) ----

export interface PasswordProtected { v: 1; salt: string; iterations: number; data: string }

/** Encrypts text with a password (same scheme as the passcode: PBKDF2-SHA-256 key, AES-256-GCM). */
export async function encryptWithPassword(text: string, password: string): Promise<PasswordProtected> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(password, salt, ITERATIONS);
  return { v: 1, salt: b64(salt), iterations: ITERATIONS, data: await encryptWith(k, text) };
}

/** Decrypts text encrypted with encryptWithPassword; throws if the password is wrong or the data damaged. */
export async function decryptWithPassword(payload: PasswordProtected, password: string): Promise<string> {
  const k = await deriveKey(password, unb64(payload.salt), payload.iterations);
  return decryptWith(k, payload.data);
}
