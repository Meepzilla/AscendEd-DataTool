// Passcode protection: student data (students, sessions and unsaved Data Entry work) is stored encrypted on the
// device, readable only after the passcode is entered.
//
// - The passcode is never stored. A key is derived from it (PBKDF2-SHA-256, 600,000 rounds, random salt),
//   and that key wraps a random data key (AES-256-GCM) that encrypts the data. Only the salt, the wrapped
//   data key, and a small encrypted check value are kept, to tell a right passcode from a wrong one.
//   Changing the passcode re-wraps the data key instead of re-encrypting the data. A recovery key,
//   shown once at setup, wraps the same data key a second time, so it can unlock the data when the
//   passcode is forgotten. Neither the passcode nor the recovery key is stored anywhere on the device.
// - After unlocking, the decrypted data is held in memory for the app (which reads and writes storage
//   synchronously); each write is encrypted and stored, in order. Locking reloads the page,
//   which clears the memory and the key.
// - Without protection, everything works as before (plain storage).
//
// Durability: a write is not reported as saved until it has landed. setItemAsync resolves only after the
// value is in durable storage and read back, and flushWrites throws when a background write failed, so
// callers can roll back instead of showing success for data that never reached disk. A background write
// that fails transiently is retried (up to PERSIST_MAX_ATTEMPTS); a quota failure is not retried, since
// waiting cannot free space. The synchronous
// setItem is kept for fire-and-forget writes (the Data Entry draft) only; committed data uses setItemAsync.
//
// Storage backend: the three main lists (students, goal templates, sessions) live as per-record rows in
// IndexedDB (see indexed-db-store.ts), one row per record, each record encrypted the same way as before
// when protection is on. Student groups and custom ABC lists are single localStorage values, encrypted
// the same way. Other keys, and lists that have not migrated yet (a corrupt localStorage blob is never
// migrated), stay in localStorage. The in-memory cache is still the synchronous read path: it is filled
// from IndexedDB by hydrateLists (data-store.ts) when the app loads, before anything reads a list.
//
// A forgotten passcode can be recovered with the recovery key (see unlockWithRecoveryKey). Without
// either, the data can only be erased and restored from a backup.

import { getLockoutRemainingMs, isLockedOut, recordAttempt } from './attempt-lockout';
import * as idb from './indexed-db-store';
import { isQuotaError } from './storage-failure';

const CONFIG_KEY = 'ascended_passcode_v1';
const ITERATIONS = 600_000;
/**
 * The most PBKDF2 iterations opening a password-protected backup may run. The app writes ITERATIONS
 * today; the ceiling is a clear multiple of that with headroom for future increases. A backup naming
 * more is treated as damaged rather than derived, because the count comes from the file and derivation
 * runs it as stated, so a crafted count in the hundreds of millions would hang the tab.
 */
export const MAX_BACKUP_ITERATIONS = 5_000_000;
const PREFIX = 'enc1:';
/** Known plaintext encrypted under the data key, to tell a right passcode or recovery key from a wrong one. Not a secret. */
export const CHECK_TEXT = 'ascended-passcode-check';
const SPACE_CHECK_KEY = '__ascended_space_check';
/** LocalStorage flag: an IndexedDB scan found no rows still encrypted under the old passcode key. */
const DEK_IDB_FLAG_KEY = 'ascended_dek_idb_migrated_v1';
/** localStorage key holding { [storageKey]: true } for lists already moved to IndexedDB. */
const MIGRATION_FLAG_KEY = 'ascended_idb_migrated_v1';
/** localStorage key set by eraseProtectedData so a reload ignores IndexedDB rows even if it lands first. */
const ERASED_KEY = 'ascended_idb_erased_v1';
export const MIN_PASSCODE_LENGTH = 6;

/**
 * Keys holding student data, encrypted when passcode protection is on. The goal templates list is
 * included whole, built-ins and all: custom templates share the list with the 903 seeded built-ins,
 * so splitting it per record would need a second store, and a renamed built-in can carry the user's
 * own wording. The built-ins themselves are public content shipped in the app, so encrypting them
 * buys uniformity rather than secrecy — the point is that no custom template can leak through a
 * plaintext list. Student groups (student IDs) and custom ABC lists (behavior wording) are in too.
 * Display settings stay as they are.
 */
const SENSITIVE = /^ascended_(students_v2|sessions_v2|data_entry_draft_v1|goal_templates_v2|student_groups_v1|abc_lists)(_|$)/;
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

/** Lists whose storage could not be read this time (not damaged: reopening the app reads them again). */
const readFailed = new Set<string>();

/**
 * Marks a list that could not be read from storage this time (IndexedDB failed, even after retrying). It is
 * protected like a damaged list (never written over) until the app is opened again, but it is not damaged:
 * the user is told to reopen the app, not to restore a backup (a restore would replace the intact data).
 */
export function markListReadFailed(key: string) {
  markListUndecryptable(key);
  readFailed.add(key);
}

export function isListReadFailed(key: string) {
  return readFailed.has(key);
}

// How many records each IndexedDB list held when it was last saved or read, so code that can't wait for
// IndexedDB (the first-run check, before the app loads) can tell whether a student or session was stored.
const LIST_COUNTS_KEY = 'ascended_idb_counts_v1';

function readListCounts(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIST_COUNTS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

/** Records how many records a list holds in IndexedDB (a hint for idbMayHoldStudentData). */
export function recordListCount(storageKey: string, count: number) {
  const info = listKeyInfo(storageKey);
  if (!info) return;
  try {
    const counts = readListCounts();
    if (counts[info.store] === count) return;
    counts[info.store] = count;
    localStorage.setItem(LIST_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // A hint only.
  }
}

/**
 * Whether students or sessions may be stored in IndexedDB, without opening it (synchronous). Uses the record
 * counts; a list moved to IndexedDB before the counts were kept is assumed to hold data.
 */
export function idbMayHoldStudentData(): boolean {
  const counts = readListCounts();
  const flags = migrationFlags();
  for (const info of LIST_KEYS) {
    if (info.store === idb.LIST_STORES.goalTemplates) continue; // seeded on first load: says nothing
    const count = counts[info.store];
    if (count !== undefined) {
      if (count > 0) return true;
      continue;
    }
    if (Object.entries(flags).some(([k, migrated]) => migrated && k.startsWith(`${info.base}_`))) return true;
  }
  return false;
}

/**
 * Forgets that a stored value couldn't be read, so it may be replaced. Only a restore may do this:
 * it is how damaged data is recovered, and ordinary saves must never overwrite damaged data.
 */
export function clearUndecryptable(storageKey: string) {
  undecryptable.delete(storageKey);
  readFailed.delete(storageKey);
}

/**
 * Re-reads one localStorage-backed sensitive key from durable storage into the cache, so a change
 * made in another tab (which the cache would otherwise not see) shows up. Returns whether the cached
 * value changed. Only for single-value localStorage keys (student groups, ABC lists, the draft):
 * the three main lists refresh through hydrateLists instead. A damaged value stays marked and is
 * never refreshed over.
 */
export async function refreshFromStorage(storageKey: string): Promise<boolean> {
  if (!isSensitiveKey(storageKey) || !isPasscodeEnabled() || !key) return false;
  if (undecryptable.has(storageKey)) return false;
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return false;
  }
  if (raw === null) {
    if (cache.get(storageKey) === undefined || cache.get(storageKey) === null) return false;
    cache.set(storageKey, null);
    return true;
  }
  if (!raw.startsWith(PREFIX)) return false;
  let plain: string;
  try {
    plain = await decryptStoredValue(storageKey, raw);
  } catch {
    undecryptable.add(storageKey);
    cache.set(storageKey, '\u0000damaged');
    return false;
  }
  if (cache.get(storageKey) === plain) return false;
  cache.set(storageKey, plain);
  return true;
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

/**
 * Passcode config, versioned. v1 (before the wrapped-key scheme) encrypted the data directly
 * under the passcode-derived key, with the check value encrypted under that same key. v2 keeps
 * a random data key that encrypts the data, wrapped once under the passcode-derived key
 * (wrappedDek) and, when a recovery key was set up, once under the recovery-key-derived key
 * (wrappedDekRecovery). The check value is encrypted under the data key in v2.
 */
interface PasscodeConfigV1 { v: 1; salt: string; iterations: number; check: string; autoLockMinutes?: number }
interface PasscodeConfigV2 {
  v: 2; salt: string; iterations: number; check: string; autoLockMinutes?: number;
  /** The data key, AES-GCM-wrapped under the passcode-derived key (IV-prefixed, base64, `enc1:`). */
  wrappedDek: string;
  /** Salt for the recovery-key-derived key, when a recovery key was set up. */
  recoverySalt?: string;
  recoveryIterations?: number;
  /** The data key, AES-GCM-wrapped under the recovery-key-derived key. */
  wrappedDekRecovery?: string;
}
type PasscodeConfig = PasscodeConfigV1 | PasscodeConfigV2;

/** A stored list that could not be read and was left exactly as stored (damaged, quarantined). */
export interface QuarantinedList { key: string; label: string; }

let key: CryptoKey | null = null;
/**
 * The passcode-derived key for this session, kept only in memory. It opens values an
 * interrupted migration left encrypted under it (see decryptStoredValue), and it is cleared
 * on lock, on erase, and when the passcode is reset with a recovery key. It is never stored.
 */
let legacyKey: CryptoKey | null = null;
/** LocalStorage-backed keys still stored under the old passcode key (their re-encryption failed or is pending). */
const legacyKeys = new Set<string>();
/** IndexedDB stores holding rows still stored under the old passcode key. */
const legacyStores = new Set<idb.ListStoreName>();
const cache = new Map<string, string | null>();
const writing = new Map<string, Promise<void>>();
const dirty = new Set<string>();
/** Stored student-data values that couldn't be decrypted at unlock (damaged); they are left as stored. */
const undecryptable = new Set<string>();
let onWriteError: ((error: unknown, storageKey?: string) => void) | null = null;

/**
 * How many times a background write is attempted before it is reported as failed. A transient
 * failure (an IndexedDB write interrupted, a locked store) can land on a retry; a full quota
 * cannot clear itself by waiting, so quota failures are not retried (see persist).
 */
export const PERSIST_MAX_ATTEMPTS = 3;
export const PERSIST_RETRY_DELAYS_MS = [250, 1000];
let persistRetryDelays = [...PERSIST_RETRY_DELAYS_MS];
/** Test-only: shorten the wait between persist retries (module reload restores the defaults). */
export function setPersistRetryDelaysForTests(delays: number[]) {
  persistRetryDelays = delays;
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
/** Called when a background write fails (e.g. storage full), so the app can say so. The key is passed so the app knows what failed to save (the Data Entry draft, the student groups, a list). */
export function setWriteErrorHandler(handler: ((error: unknown, storageKey?: string) => void) | null) {
  onWriteError = handler;
}

async function deriveKey(passcode: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
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
 * (students, sessions, goal templates, student groups, ABC lists, the Data Entry draft) are encrypted
 * when protection is on, everything else is stored as it is.
 */
export async function encryptStoredValue(storageKey: string, text: string): Promise<string> {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) throw new Error('Locked');
    return encryptWith(key, text);
  }
  return text;
}

/** Decrypts one stored string; throws when it is encrypted and neither the data key nor the old passcode key opens it. */
export async function decryptStoredValue(storageKey: string, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!isSensitiveKey(storageKey) || !key) throw new Error('Locked');
  try {
    return await decryptWith(key, stored);
  } catch (error) {
    // Still stored under the old passcode key (an interrupted migration): readable this session.
    if (legacyKey) {
      try {
        return await decryptWith(legacyKey, stored);
      } catch {
        /* fall through to the original error */
      }
    }
    throw error;
  }
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
    recordListCount(storageKey, 0);
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
  recordListCount(storageKey, records.length);
  // The rows are now under the data key (or plaintext when protection is off), not the old passcode key.
  if (isPasscodeEnabled()) legacyStores.delete(info.store);
}

/** Waits until no write is pending for the key (including one re-queued while waiting). Throws if it failed. */
async function awaitPersisted(storageKey: string): Promise<void> {
  while (writing.has(storageKey)) {
    await writing.get(storageKey)!;
  }
}

/** One attempt to write a key's cached value to durable storage. Throws on any failure. */
async function persistOnce(storageKey: string): Promise<void> {
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
  // The stored value is now under the data key, not the old passcode key.
  legacyKeys.delete(storageKey);
}

function persist(storageKey: string) {
  if (writing.has(storageKey)) { dirty.add(storageKey); return; }
  const run = (async () => {
    // A failed write is retried (a transient IndexedDB failure can land on a retry), except a
    // quota failure, which waiting cannot fix. Only when the attempts are used up is the failure
    // reported — once, not once per attempt — and the write promise rejects, so flushWrites
    // throws on it and setItemAsync (which awaits the same write) rejects: no caller can report
    // success for it. The cache keeps the unsaved value, so the next save of this key tries
    // again from where it left off instead of silently dropping the change.
    let lastError: unknown;
    for (let attempt = 0; attempt < PERSIST_MAX_ATTEMPTS; attempt++) {
      try {
        await persistOnce(storageKey);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (isQuotaError(error)) break;
        if (attempt < PERSIST_MAX_ATTEMPTS - 1) await delay(persistRetryDelays[attempt] ?? 1000);
      }
    }
    if (lastError !== undefined) {
      onWriteError?.(lastError, storageKey);
      throw lastError;
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

/** A human-readable name for a stored list, for telling the user which list could not be read. */
export function labelForStorageKey(storageKey: string): string {
  if (storageKey.startsWith('ascended_students_v2_')) return 'Students';
  if (storageKey.startsWith('ascended_sessions_v2_')) return 'Sessions';
  if (storageKey.startsWith('ascended_goal_templates_v2_')) return 'Goal templates';
  if (storageKey.startsWith('ascended_data_entry_draft_v1_')) return 'Data Entry draft';
  if (storageKey.startsWith('ascended_student_groups_v1_')) return 'Student groups';
  if (storageKey === 'ascended_abc_lists') return 'ABC lists';
  return storageKey;
}

/** Lists that could not be read and were left exactly as stored (damaged, quarantined). */
export function getQuarantinedLists(): QuarantinedList[] {
  return [...undecryptable].map(storageKey => ({ key: storageKey, label: labelForStorageKey(storageKey) }));
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
  const result = await readDurableListResult(storageKey);
  return result.ok ? result.values : undefined;
}

/**
 * Like readDurableList, but says why a list couldn't be read: 'read-failed' when storage itself could not be
 * read (IndexedDB failed even after retrying, e.g. iPad Safari's "connection to Indexed Database server lost",
 * which a reload fixes), 'unreadable' when it was read but a record can't be decrypted or parsed (damaged).
 */
export async function readDurableListResult(storageKey: string): Promise<{ ok: true; values: unknown[] } | { ok: false; reason: 'read-failed' | 'unreadable' }> {
  if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
    const info = listKeyInfo(storageKey)!;
    let rows: idb.IdRecord[] | null = null;
    for (let attempt = 0; attempt < PERSIST_MAX_ATTEMPTS && rows === null; attempt++) {
      try {
        rows = await idb.getAllRecords(info.store);
      } catch {
        if (attempt < PERSIST_MAX_ATTEMPTS - 1) await delay(persistRetryDelays[attempt] ?? 1000);
      }
    }
    if (rows === null) return { ok: false, reason: 'read-failed' };
    try {
      const values: unknown[] = [];
      for (const row of rows) values.push(JSON.parse(await decryptStoredValue(storageKey, row.v)));
      return { ok: true, values };
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }
  const values = await readLocalStorageList(storageKey);
  return values === undefined ? { ok: false, reason: 'unreadable' } : { ok: true, values };
}

/** A list stored as one localStorage blob, decrypted when protection is on. Undefined when it cannot be read. */
async function readLocalStorageList(storageKey: string): Promise<unknown[] | undefined> {
  try {
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

/**
 * Runs `onStored` once the key's latest value is stored: straight away when nothing is pending (protection off
 * writes synchronously), else after its background write. Not run if that write fails (the failure is reported).
 */
export function afterStored(storageKey: string, onStored: () => void) {
  if (!writing.has(storageKey)) {
    onStored();
    return;
  }
  awaitPersisted(storageKey).then(onStored, () => { /* reported by the write error handler */ });
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
    localStorage.removeItem(LIST_COUNTS_KEY);
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

// The data key is a random AES-256-GCM key, generated once and wrapped (AES-GCM key wrap)
// under each credential that may open it: the passcode-derived key and, when one was set up,
// the recovery-key-derived key. The wrapped keys are stored; the data key itself is never
// stored. Changing the passcode re-wraps the data key, so the data is not re-encrypted.

/** Wraps the data key under a credential-derived key; IV-prefixed, base64, `enc1:`. */
async function wrapDek(dek: CryptoKey, kek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv }));
  const all = new Uint8Array(12 + wrapped.length);
  all.set(iv);
  all.set(wrapped, 12);
  return PREFIX + b64Chunked(all);
}

/** Unwraps a data key wrapped with wrapDek; throws when the credential key is wrong. */
async function unwrapDek(wrapped: string, kek: CryptoKey): Promise<CryptoKey> {
  if (!wrapped.startsWith(PREFIX)) throw new Error('Not a wrapped key');
  const all = unb64(wrapped.slice(PREFIX.length));
  return crypto.subtle.unwrapKey(
    'raw', all.subarray(12), kek, { name: 'AES-GCM', iv: all.subarray(0, 12) },
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

/** A fresh random data key. Extractable, so it can be wrapped under a credential key. */
async function newDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

// ---- Recovery key ----

// A recovery key is 20 random bytes (160 bits) shown as 32 Crockford base32 characters in
// 8 groups of 4 (e.g. `7K3Q-9X2M-...`). Crockford leaves out I, L, O and U, so what the user
// types back is unambiguous; typing still accepts lowercase, dashes, spaces, and I/L as 1
// and O as 0. The key itself is never stored: only a wrapped copy of the data key, under a
// key derived from it with the same PBKDF2 parameters as the passcode.

const RECOVERY_KEY_BYTES = 20;
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Generates a recovery key to show the user once, in `XXXX-XXXX-...` form. */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_KEY_BYTES));
  const chars: string[] = [];
  // 5 bits at a time; the buffer is masked down after each character, so it never grows past 12 bits.
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      chars.push(CROCKFORD_ALPHABET[(value >> bits) & 31]);
      value &= (1 << bits) - 1;
    }
  }
  if (bits > 0) chars.push(CROCKFORD_ALPHABET[(value << (5 - bits)) & 31]);
  return [0, 1, 2, 3, 4, 5, 6, 7].map(g => chars.slice(g * 4, g * 4 + 4).join('')).join('-');
}

/** The canonical form of a typed recovery key, or null when it cannot be one. */
export function normalizeRecoveryKey(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, '').replace(/I/g, '1').replace(/L/g, '1').replace(/O/g, '0');
  if (cleaned.length !== RECOVERY_KEY_BYTES * 8 / 5) return null;
  if ([...cleaned].some(c => !CROCKFORD_ALPHABET.includes(c))) return null;
  return cleaned;
}

/** The data key for the passcode, or null if it is wrong. For a v1 config the passcode-derived key itself. */
async function keyFor(passcode: string, config: PasscodeConfig): Promise<CryptoKey | null> {
  const kek = await deriveKey(passcode, unb64(config.salt), config.iterations);
  if (config.v === 1) {
    try {
      return (await decryptWith(kek, config.check)) === CHECK_TEXT ? kek : null;
    } catch {
      return null;
    }
  }
  try {
    const dek = await unwrapDek(config.wrappedDek, kek);
    return (await decryptWith(dek, config.check)) === CHECK_TEXT ? dek : null;
  } catch {
    return null;
  }
}

/** The data key for a recovery key, or null when it is wrong or none is set up. */
async function dekFromRecoveryKey(input: string, config: PasscodeConfig): Promise<CryptoKey | null> {
  if (config.v !== 2 || !config.wrappedDekRecovery || !config.recoverySalt) return null;
  const normalized = normalizeRecoveryKey(input);
  if (!normalized) return null;
  try {
    const rkek = await deriveKey(normalized, unb64(config.recoverySalt), config.recoveryIterations ?? ITERATIONS);
    const dek = await unwrapDek(config.wrappedDekRecovery, rkek);
    return (await decryptWith(dek, config.check)) === CHECK_TEXT ? dek : null;
  } catch {
    return null;
  }
}

function clearDekIdbFlag() {
  try {
    localStorage.removeItem(DEK_IDB_FLAG_KEY);
  } catch {
    /* the flag is a hint */
  }
}

/**
 * Moves a v1 install (data encrypted directly under the passcode key) to the wrapped-key
 * scheme. The new config is written first: from that point the data key is recoverable from
 * storage, so a migration interrupted after this line still leaves every value readable on
 * the next unlock, through the legacy-key fallback. Returns the new data key.
 */
async function migrateV1ToWrappedKey(kek: CryptoKey, config: PasscodeConfigV1): Promise<CryptoKey> {
  const dek = await newDataKey();
  const nextConfig: PasscodeConfigV2 = {
    v: 2, salt: config.salt, iterations: config.iterations,
    check: await encryptWith(dek, CHECK_TEXT), wrappedDek: await wrapDek(dek, kek),
    autoLockMinutes: config.autoLockMinutes,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  key = dek;
  return dek;
}

/**
 * Reads every sensitive localStorage value into the cache, decrypting with the data key and
 * falling back to the old passcode key for values an interrupted migration left behind.
 * Values still under the old key are re-encrypted under the data key; values that decrypt
 * under neither key stay exactly as stored, marked unreadable. With fillCache false the
 * in-memory cache is left alone (a change or disable on an already-unlocked app).
 */
async function loadAndMigrateValues(kek: CryptoKey | null, dek: CryptoKey, fillCache: boolean, configJson: string): Promise<void> {
  if (fillCache) {
    cache.clear();
    undecryptable.clear();
  }
  legacyKeys.clear();
  const toRewrite: [string, string][] = [];
  for (const storageKey of sensitiveKeysInStorage()) {
    const stored = localStorage.getItem(storageKey)!;
    let plain: string | null = null;
    let legacy = false;
    if (!stored.startsWith(PREFIX)) {
      // Stored plaintext (written before protection was on): readable, needs encrypting.
      plain = stored;
      legacy = true;
    } else {
      try {
        plain = await decryptWith(dek, stored);
      } catch {
        if (kek) {
          try {
            plain = await decryptWith(kek, stored);
            legacy = true;
          } catch {
            plain = null;
          }
        }
      }
    }
    if (plain === null) {
      undecryptable.add(storageKey);
      if (fillCache) cache.set(storageKey, '\u0000damaged');
      continue;
    }
    if (fillCache) cache.set(storageKey, plain);
    if (legacy) toRewrite.push([storageKey, await encryptWith(dek, plain)]);
  }
  if (toRewrite.length) {
    try {
      rewriteAll(toRewrite, configJson);
    } catch {
      // rewriteAll puts everything back as it was: the values stay under the old key and are
      // still readable this session (and on the next unlock); the next save migrates them.
      for (const [storageKey] of toRewrite) legacyKeys.add(storageKey);
    }
  }
}

/**
 * Finds IndexedDB rows still encrypted under the old passcode key. Rows are never rewritten
 * here: they stay readable through the legacy-key fallback, migrate when the list is next
 * saved, and are re-encrypted before any passcode change (see reencryptLegacyValues). A row
 * that decrypts under neither key is damaged, not legacy: hydrateLists marks that list
 * unreadable, and it is left exactly as stored. Once a scan finds no legacy rows, the flag
 * is set and later unlocks skip the scan.
 */
async function scanIdbLegacy(kek: CryptoKey | null, dek: CryptoKey): Promise<void> {
  if (!kek || !idb.isIndexedDbSupported()) return;
  try {
    if (localStorage.getItem(DEK_IDB_FLAG_KEY) === '1') return;
  } catch {
    return;
  }
  const candidates = new Set<string>();
  for (const storageKey of cache.keys()) if (isListKey(storageKey)) candidates.add(storageKey);
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (storageKey && isListKey(storageKey)) candidates.add(storageKey);
  }
  for (const storageKey of Object.keys(migrationFlags())) if (isListKey(storageKey)) candidates.add(storageKey);
  let anyLegacy = false;
  for (const storageKey of candidates) {
    if (getListBackend(storageKey) !== 'idb') continue;
    const info = listKeyInfo(storageKey);
    if (!info) continue;
    let rows: idb.IdRecord[];
    try {
      rows = await idb.getAllRecords(info.store);
    } catch {
      continue;
    }
    let legacy = false;
    let damaged = false;
    for (const row of rows) {
      if (!row.v.startsWith(PREFIX)) {
        legacy = true;
        continue;
      }
      try {
        await decryptWith(dek, row.v);
      } catch {
        try {
          await decryptWith(kek, row.v);
          legacy = true;
        } catch {
          damaged = true;
        }
      }
    }
    if (damaged) continue;
    if (legacy) {
      legacyStores.add(info.store);
      anyLegacy = true;
    }
  }
  if (!anyLegacy) {
    try {
      localStorage.setItem(DEK_IDB_FLAG_KEY, '1');
    } catch {
      /* the flag is a hint */
    }
  }
}

/**
 * Re-encrypts every readable value still stored under the old passcode key under the data
 * key, so the data key can then be re-wrapped under a new passcode without stranding it.
 * Throws (before anything is re-wrapped) when a value cannot be written, e.g. storage full.
 * Damaged lists are not touched: they are quarantined by the caller, not re-encrypted.
 */
async function reencryptLegacyValues(): Promise<void> {
  for (const storageKey of [...legacyKeys]) {
    if (isUndecryptable(storageKey)) {
      legacyKeys.delete(storageKey);
      continue;
    }
    const plain = cache.get(storageKey);
    if (plain === undefined || plain === null || plain === '\u0000damaged') {
      legacyKeys.delete(storageKey);
      continue;
    }
    if (isListKey(storageKey) && getListBackend(storageKey) === 'idb') {
      await persistListRecords(storageKey);
    } else {
      await setItemAsync(storageKey, plain);
    }
    legacyKeys.delete(storageKey);
  }
  for (const info of LIST_KEYS) {
    if (!legacyStores.has(info.store)) continue;
    const storageKey = [...cache.keys()].find(k => k.startsWith(`${info.base}_`));
    if (!storageKey) {
      throw new Error('Some saved data is still stored under the old passcode and is not loaded. Lock the app and unlock it again, then try.');
    }
    if (isUndecryptable(storageKey)) {
      legacyStores.delete(info.store);
      continue;
    }
    await persistListRecords(storageKey);
    legacyStores.delete(info.store);
  }
  if (legacyStores.size === 0 && legacyKeys.size === 0) {
    try {
      localStorage.setItem(DEK_IDB_FLAG_KEY, '1');
    } catch {
      /* the flag is a hint */
    }
  }
}

/**
 * Moves a v1 install to the wrapped-key scheme on an already-unlocked app (change or
 * disable). Unlocking already migrates, so this only runs when a v1 config is somehow
 * still present while unlocked; it never clears the in-memory cache.
 */
async function ensureWrappedKey(currentPasscode: string): Promise<void> {
  const config = readConfig();
  if (!config || config.v !== 1) return;
  const kek = await deriveKey(currentPasscode, unb64(config.salt), config.iterations);
  let ok = false;
  try {
    ok = (await decryptWith(kek, config.check)) === CHECK_TEXT;
  } catch {
    ok = false;
  }
  if (!ok) throw new Error('The current passcode is wrong.');
  await migrateV1ToWrappedKey(kek, config);
  legacyKey = kek;
  await loadAndMigrateValues(kek, key!, false, JSON.stringify(readConfig()));
  await scanIdbLegacy(kek, key!);
}

/** Unlocks with the passcode: true if it is right (the data is then decrypted into memory). */
export async function unlock(passcode: string): Promise<boolean> {
  const config = readConfig();
  if (!config) return true;
  // Locked out after repeated wrong passcodes: fail immediately, without recording another failure
  // (a locked-out attempt must not extend the lockout) and without deriving a key.
  if (isLockedOut('passcode')) return false;
  if (config.v === 1) {
    const kek = await deriveKey(passcode, unb64(config.salt), config.iterations);
    let ok = false;
    try {
      ok = (await decryptWith(kek, config.check)) === CHECK_TEXT;
    } catch {
      ok = false;
    }
    if (!ok) {
      recordAttempt('passcode', false);
      return false;
    }
    recordAttempt('passcode', true);
    // Migrate to the wrapped-key scheme on this unlock: the data is re-encrypted under the
    // new data key, and a recovery key can be set up from Settings once migrated.
    const dek = await migrateV1ToWrappedKey(kek, config);
    legacyKey = kek;
    await loadAndMigrateValues(kek, dek, true, JSON.stringify(readConfig()));
    await scanIdbLegacy(kek, dek);
    await sealPlaintextRows();
    return true;
  }
  const kek = await deriveKey(passcode, unb64(config.salt), config.iterations);
  let dek: CryptoKey | null = null;
  try {
    dek = await unwrapDek(config.wrappedDek, kek);
    if ((await decryptWith(dek, config.check)) !== CHECK_TEXT) dek = null;
  } catch {
    dek = null;
  }
  if (!dek) {
    recordAttempt('passcode', false);
    return false;
  }
  recordAttempt('passcode', true);
  key = dek;
  legacyKey = kek;
  await loadAndMigrateValues(kek, dek, true, JSON.stringify(config));
  await scanIdbLegacy(kek, dek);
  await sealPlaintextRows();
  return true;
}

/**
 * A fresh data key wrapped under a new passcode (and, when given, a recovery key).
 * Throws when the recovery key is not a valid one.
 */
async function newWrappedKey(passcode: string, recoveryKey?: string): Promise<{
  dek: CryptoKey; kek: CryptoKey; wrappedDek: string; salt: string;
  recovery?: { salt: string; iterations: number; wrappedDek: string };
}> {
  const dek = await newDataKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveKey(passcode, salt, ITERATIONS);
  const wrappedDek = await wrapDek(dek, kek);
  let recovery: { salt: string; iterations: number; wrappedDek: string } | undefined;
  if (recoveryKey !== undefined) {
    const normalized = normalizeRecoveryKey(recoveryKey);
    if (!normalized) throw new Error('That recovery key is not valid.');
    const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
    const rkek = await deriveKey(normalized, recoverySalt, ITERATIONS);
    recovery = { salt: b64(recoverySalt), iterations: ITERATIONS, wrappedDek: await wrapDek(dek, rkek) };
  }
  return { dek, kek, wrappedDek, salt: b64(salt), recovery };
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
 * Rewrites IndexedDB list rows straight from storage, whether or not their list is loaded (the lock screen can
 * turn protection on before any list is loaded): `transform` maps a stored value to the value to store, null
 * leaves the row as it is, and throwing refuses. Every row of every list is read and transformed before anything
 * is written, so a refusal changes nothing. Pending writes finish first. Throws when a write fails; rows already
 * written stay written, so callers order their steps so that any mix of old and new rows is still readable.
 */
async function rewriteIdbRows(transform: (stored: string) => Promise<string | null>): Promise<void> {
  if (!idb.isIndexedDbSupported()) return;
  try {
    await flushWrites();
  } catch {
    // A failed pending write was already reported; what is stored is what gets rewritten.
  }
  const plan: [idb.ListStoreName, idb.IdRecord[]][] = [];
  for (const store of Object.values(idb.LIST_STORES)) {
    const changed: idb.IdRecord[] = [];
    for (const row of await idb.getAllRecords(store)) {
      const next = await transform(row.v);
      if (next !== null && next !== row.v) changed.push({ ...row, v: next });
    }
    plan.push([store, changed]);
  }
  for (const [store, rows] of plan) if (rows.length) await idb.putRecords(store, rows);
}

/** A stored value as plaintext: under the data key, else the passcode key of an older install. Throws if neither opens it. */
async function decryptAny(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  if (!key) throw new Error('Locked');
  try {
    return await decryptWith(key, stored);
  } catch (error) {
    if (legacyKey) return decryptWith(legacyKey, stored);
    throw error;
  }
}

/**
 * With protection on, every IndexedDB row should be encrypted. Rows left as plaintext (an earlier version could
 * turn protection on without encrypting lists that weren't loaded yet) are encrypted under the data key. Runs
 * after unlocking, before the app loads; best effort, tried again on the next unlock.
 */
async function sealPlaintextRows() {
  if (!key) return;
  const dek = key;
  try {
    await rewriteIdbRows(async stored => (stored.startsWith(PREFIX) ? null : encryptWith(dek, stored)));
  } catch {
    // Still readable (plaintext passes through decryption); sealed on a later unlock.
  }
}

/** Turns protection on: encrypts the student data with a new passcode. When a recovery key is given, it is set up too (see generateRecoveryKey). */
export async function enablePasscode(passcode: string, autoLockMinutes = 15, recoveryKey?: string) {
  if (passcode.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  if (isPasscodeEnabled()) throw new Error('Passcode protection is already on.');
  const { dek, kek, wrappedDek, salt, recovery } = await newWrappedKey(passcode, recoveryKey);
  const config: PasscodeConfigV2 = {
    v: 2, salt, iterations: ITERATIONS, check: await encryptWith(dek, CHECK_TEXT), wrappedDek, autoLockMinutes,
    ...(recovery ? { recoverySalt: recovery.salt, recoveryIterations: recovery.iterations, wrappedDekRecovery: recovery.wrappedDek } : {}),
  };
  const readStorage = () => sensitiveKeysInStorage().map(storageKey => [storageKey, localStorage.getItem(storageKey)] as [string, string | null]);
  const encrypted = await encodeCurrent(readStorage, value => encryptWith(dek, value), false);
  const plain = readStorage();
  rewriteAll(encrypted, JSON.stringify(config));
  key = dek;
  legacyKey = kek;
  // Lists already in IndexedDB have no localStorage blob, so they are not in `plain`: keep their
  // in-memory values and re-encrypt their rows with the new key instead of dropping them.
  const listCache = [...cache].filter(([storageKey]) => isListKey(storageKey) && getListBackend(storageKey) === 'idb');
  cache.clear();
  plain.forEach(([storageKey, value]) => cache.set(storageKey, value));
  listCache.forEach(([storageKey, value]) => cache.set(storageKey, value));
  // Every IndexedDB row, loaded or not: plaintext rows are encrypted with the new data key. A row that is already
  // encrypted can't be read without the key it was written with, so it is left as it is (it was already unreadable).
  // If this stops part way, the rest stay plaintext and readable, and the next unlock encrypts them.
  await rewriteIdbRows(async stored => (stored.startsWith(PREFIX) ? null : encryptWith(dek, stored)));
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

/**
 * Changes the passcode. The data itself is not re-encrypted: the data key is re-wrapped under
 * the new passcode. Needs the current passcode. Lists that cannot be read are quarantined, not
 * a reason to refuse: they stay exactly as stored, stay marked unreadable, and are reported
 * in the return value (restoring a backup is the way to recover them). Readable lists convert.
 */
export async function changePasscode(current: string, next: string): Promise<{ quarantined: QuarantinedList[] }> {
  if (next.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  await confirmPasscode(current, 'The current passcode is wrong.');
  await ensureWrappedKey(current);
  // Values still stored under the old passcode key must be under the data key before it is
  // re-wrapped, or the new passcode could not open them. Damaged lists are skipped, not touched.
  await reencryptLegacyValues();
  const config = readConfig();
  if (!config || config.v !== 2 || !key) throw new Error('Passcode protection is off.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newKek = await deriveKey(next, salt, ITERATIONS);
  const wrappedDek = await wrapDek(key, newKek);
  const nextConfig: PasscodeConfigV2 = { ...config, salt: b64(salt), iterations: ITERATIONS, wrappedDek };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  legacyKey = newKek;
  return { quarantined: getQuarantinedLists() };
}

/**
 * Turns protection off: the student data is stored unencrypted again. Needs the passcode.
 *
 * Refused while any list can't be read: turning protection off deletes the passcode configuration, which holds
 * the only (wrapped) copy of the data key, so a damaged list's intact records could never be opened again.
 * Restoring a backup replaces the damaged list; protection can then be turned off.
 *
 * Order matters: the IndexedDB rows are made plaintext first, while the configuration is still stored. If that
 * stops part way (storage full, the app closed), protection is still on and every row, plaintext or encrypted,
 * still opens, so turning it off can simply be tried again. The configuration is removed only once no row is
 * left encrypted.
 */
export async function disablePasscode(current: string): Promise<{ quarantined: QuarantinedList[] }> {
  await confirmPasscode(current, 'The passcode is wrong.');
  await ensureWrappedKey(current);
  const damaged = getQuarantinedLists();
  if (damaged.length) {
    throw new Error(`Passcode protection can't be turned off while some data can't be read (${damaged.map(q => q.label).join(', ')}): turning it off would remove the only key to it. Restore a backup in Settings first, then turn protection off.`);
  }
  const toPlain = async (stored: string) => {
    if (!stored.startsWith(PREFIX)) return null;
    try {
      return await decryptAny(stored);
    } catch {
      throw new Error("Passcode protection can't be turned off: some saved data can't be opened with this passcode. Restore a backup in Settings first, then turn protection off.");
    }
  };
  // Until no background write is pending, so none lands encrypted after the rows were made plaintext.
  for (let pass = 0; pass < 5; pass++) {
    await rewriteIdbRows(toPlain);
    if (writing.size === 0) break;
  }
  if (writing.size !== 0) throw new Error('Data is still being saved. Wait a moment, then try again.');
  const plain = await encodeCurrent(cachedValues, async value => value, true);
  // Nothing awaits from here until the configuration is removed, so no write can start in between.
  if (writing.size !== 0) throw new Error('Data is still being saved. Wait a moment, then try again.');
  rewriteAll(plain, null);
  // cache.clear() below would drop the IndexedDB lists (they have no localStorage value to restore
  // from), so keep them; their rows are already plaintext.
  const listCache = [...cache].filter(([storageKey]) => isListKey(storageKey) && getListBackend(storageKey) === 'idb');
  key = null;
  legacyKey = null;
  legacyKeys.clear();
  legacyStores.clear();
  clearDekIdbFlag();
  cache.clear();
  listCache.forEach(([storageKey, value]) => cache.set(storageKey, value));
  return { quarantined: [] };
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
  legacyKey = null;
  legacyKeys.clear();
  legacyStores.clear();
  clearDekIdbFlag();
  cache.clear();
}

/** Whether a recovery key is set up for this device. */
export function hasRecoveryKey(): boolean {
  const config = readConfig();
  return !!config && config.v === 2 && !!config.wrappedDekRecovery;
}

/**
 * Sets up a recovery key for an install that already has a passcode (for example one
 * migrated from the v1 scheme on unlock). Returns the key to show the user once: it is
 * never stored and never displayed again after the setup screen is left.
 */
export async function createRecoveryKey(): Promise<string> {
  if (!isPasscodeEnabled() || !key) throw new Error('Passcode protection is off or the app is locked.');
  const config = readConfig();
  if (!config || config.v !== 2) throw new Error('Passcode protection needs to finish setting up. Lock the app and unlock it again, then try.');
  // The recovery key opens the data key only. Rows still under the passcode key of an older install (upgraded,
  // not saved since) would stay locked behind the passcode, and resetting the passcode with the recovery key
  // would then lose them for good: re-encrypt every such row under the data key first, loaded or not. Rows
  // neither key opens are damaged already and are left as they are.
  const dek = key;
  await rewriteIdbRows(async stored => {
    if (!stored.startsWith(PREFIX)) return encryptWith(dek, stored);
    try {
      await decryptWith(dek, stored);
      return null;
    } catch {
      /* not under the data key */
    }
    if (!legacyKey) return null;
    try {
      return await encryptWith(dek, await decryptWith(legacyKey, stored));
    } catch {
      return null;
    }
  });
  legacyStores.clear();
  await reencryptLegacyValues();
  const recoveryKey = generateRecoveryKey();
  const normalized = normalizeRecoveryKey(recoveryKey)!;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rkek = await deriveKey(normalized, salt, ITERATIONS);
  const nextConfig: PasscodeConfigV2 = {
    ...config, recoverySalt: b64(salt), recoveryIterations: ITERATIONS, wrappedDekRecovery: await wrapDek(dek, rkek),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  return recoveryKey;
}

/**
 * Unlocks with the recovery key, after the passcode is forgotten: true if the key is right
 * (the data is then decrypted into memory). Wrong recovery keys count against their own
 * lockout, so a forgotten passcode that was guessed at first does not block recovery, and
 * recovery guesses do not weaken the passcode lockout either. Values still stored under
 * the forgotten passcode key cannot be opened with the recovery key: they stay exactly as
 * stored, marked unreadable, until the passcode is remembered or a backup is restored.
 */
export async function unlockWithRecoveryKey(input: string): Promise<boolean> {
  const config = readConfig();
  if (!config) return true;
  if (config.v !== 2 || !config.wrappedDekRecovery || !config.recoverySalt) return false;
  // Locked out after repeated wrong recovery keys: fail immediately, without recording another failure.
  if (isLockedOut('recovery-key')) return false;
  const dek = await dekFromRecoveryKey(input, config);
  if (!dek) {
    recordAttempt('recovery-key', false);
    return false;
  }
  recordAttempt('recovery-key', true);
  recordAttempt('passcode', true);
  key = dek;
  legacyKey = null;
  await loadAndMigrateValues(null, dek, true, JSON.stringify(config));
  return true;
}

/**
 * Sets a new passcode with the recovery key, after the passcode is forgotten. The data key
 * does not change, so the data is not re-encrypted and the same recovery key keeps working.
 * Unlocks the app when locked. Lists that cannot be read stay exactly as stored, marked
 * unreadable, and are reported in the return value.
 */
export async function resetPasscodeWithRecoveryKey(recoveryKey: string, next: string): Promise<{ quarantined: QuarantinedList[] }> {
  if (next.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  const config = readConfig();
  if (!config) throw new Error('Passcode protection is off.');
  if (config.v !== 2 || !config.wrappedDekRecovery || !config.recoverySalt) throw new Error('No recovery key is set up for this device.');
  if (isLockedOut('recovery-key')) {
    const minutes = Math.ceil(getLockoutRemainingMs('recovery-key') / 60_000);
    throw new Error(`Too many wrong recovery keys. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }
  const dek = await dekFromRecoveryKey(recoveryKey, config);
  if (!dek) {
    recordAttempt('recovery-key', false);
    throw new Error('That recovery key is not right.');
  }
  recordAttempt('recovery-key', true);
  recordAttempt('passcode', true);
  // Unlock with the recovered data key when locked, so the app opens and the data is readable.
  if (!key) {
    key = dek;
    legacyKey = null;
    await loadAndMigrateValues(null, dek, true, JSON.stringify(config));
  } else {
    key = dek;
    legacyKey = null;
  }
  // Values still stored under the forgotten passcode key cannot be read without it: they stay
  // as stored (marked unreadable) and are reported, never written over.
  await reencryptLegacyValues();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newKek = await deriveKey(next, salt, ITERATIONS);
  const wrappedDek = await wrapDek(dek, newKek);
  const nextConfig: PasscodeConfigV2 = { ...config, salt: b64(salt), iterations: ITERATIONS, wrappedDek };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  legacyKey = newKek;
  return { quarantined: getQuarantinedLists() };
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
  if (!Number.isInteger(payload.iterations) || payload.iterations < 1 || payload.iterations > MAX_BACKUP_ITERATIONS) {
    throw new Error('This backup file is damaged or was not written by this app.');
  }
  const k = await deriveKey(password, unb64(payload.salt), payload.iterations);
  return decryptWith(k, payload.data);
}
