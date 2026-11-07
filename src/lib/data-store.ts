import type { SessionData } from './types';
import { compareSessionsOldestFirst } from './helpers';
import * as secureStore from './secure-store';
import * as idb from './indexed-db-store';
import { reviveGoalTypes } from './legacy-goal-types';

// Where the student data lives on the device: one list each of students, goal templates and sessions,
// per user. Student data goes through secure-store (encrypted when passcode protection is on).
//
// Backend: the lists live as per-record rows in IndexedDB (one row per record, see indexed-db-store.ts),
// migrated from the old whole-blob localStorage values on first load. The migration is per list and
// verified: the rows are read back and compared with the blob, and only then is the list flagged as
// migrated and the blob removed. A blob that cannot be read (damaged JSON, a record without an id)
// is never migrated and never written over — that list keeps its localStorage backend until a restore
// replaces it, exactly as before.

const STUDENTS_BASE_KEY = 'ascended_students_v2';
const GOAL_TEMPLATES_BASE_KEY = 'ascended_goal_templates_v2';
const SESSIONS_BASE_KEY = 'ascended_sessions_v2';

export interface StorageKeys {
  students: string | null;
  templates: string | null;
  sessions: string | null;
}

/** The storage keys of a user's lists (null without a user). */
export function storageKeys(uid: string | undefined): StorageKeys {
  const key = (base: string) => (uid ? `${base}_${uid}` : null);
  return { students: key(STUDENTS_BASE_KEY), templates: key(GOAL_TEMPLATES_BASE_KEY), sessions: key(SESSIONS_BASE_KEY) };
}

/**
 * A stored list: [] when there is none yet, or undefined when it is there but can't be read (damaged, or not
 * a list). Goal type keys from earlier versions are read as the current ones.
 *
 * An IndexedDB list that has not been hydrated yet (hydrateLists has not run for it) also reads as
 * undefined rather than []: the cache is empty until the rows are loaded, and an empty read must never
 * be mistaken for an empty list and written over.
 */
export function readList<T>(key: string | null): T[] | undefined {
  if (typeof window === 'undefined' || !key) return [];
  if (secureStore.isListKey(key) && secureStore.getListBackend(key) === 'idb' && !secureStore.isListHydrated(key)) {
    return undefined;
  }
  try {
    const item = secureStore.getItem(key);
    const value = item ? JSON.parse(item, reviveGoalTypes) : [];
    return Array.isArray(value) ? value : undefined;
  } catch (error) {
    console.warn(`Error reading from localStorage key "${key}":`, error);
    return undefined;
  }
}

export type MigrationStatus =
  | 'migrated' // localStorage blob moved to IndexedDB and verified
  | 'already' // already in IndexedDB; cache filled from its rows
  | 'empty' // nothing stored; the list now writes straight to IndexedDB
  | 'skipped-corrupt' // blob could not be read; left in localStorage, never written over
  | 'skipped-no-idb' // no IndexedDB here; the list stays in localStorage
  | 'failed'; // migration was attempted but verification failed; blob kept, localStorage kept

export interface MigrationResult {
  key: string;
  status: MigrationStatus;
}

function isMigratableBlob(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return false;
    return parsed.every(record => typeof record === 'object' && record !== null);
  } catch {
    return false;
  }
}

function blobHasIds(value: string, idField: string): boolean {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>[];
    return parsed.every(record => typeof record[idField] === 'string' && (record[idField] as string).length > 0);
  } catch {
    return false;
  }
}

function rawLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Fills the in-memory cache for the three lists from durable storage, migrating localStorage blobs
 * into IndexedDB first where needed. Call once, before anything reads a list (the provider's load
 * effect does this). Safe to call again: already-migrated lists just re-read their rows.
 *
 * Per list, in order:
 * 1. An erase marker (eraseProtectedData ran) clears the IndexedDB rows and is removed.
 * 2. A migrated list whose localStorage blob is still there (a previous migration was interrupted
 *    after the flag was set) re-migrates from the blob, which is still the source of truth.
 * 3. A migrated list reads its rows back into the cache (decrypting each record).
 * 4. An unmigrated list with a blob migrates: rows are written, read back and compared with the blob;
 *    only on a match is the list flagged migrated and the blob removed. On any failure the blob is
 *    left exactly as it was, the partial rows are removed, and the list keeps localStorage.
 * 5. A list with nothing stored anywhere is marked empty and writes straight to IndexedDB.
 * A corrupt or partial blob (bad JSON, not a list, a record without an id) is never migrated and never
 * written over: it stays readable as damaged, as before, until a restore replaces it.
 */
export async function hydrateLists(keys: StorageKeys): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  /** Moves one blob's records into IndexedDB, verified; on failure keeps the blob and localStorage. */
  const migrateBlob = async (key: string, blob: string): Promise<MigrationStatus> => {
    const storeName = secureStore.listStoreName(key)!;
    const parsed = JSON.parse(blob) as Record<string, unknown>[];
    secureStore.setListBackend(key, 'idb');
    try {
      await secureStore.setItemAsync(key, blob);
      const verified = await secureStore.verifyStoredList(key, parsed);
      if (!verified) throw new Error('Migration verification failed.');
      // Verified: the blob is no longer read, so remove it (the rows are the copy now).
      try {
        localStorage.removeItem(key);
      } catch {
        // The rows are verified and the flag is set; a leftover blob is inert.
      }
      secureStore.markListHydrated(key);
      return 'migrated';
    } catch {
      // Verification failed: remove the partial rows and keep the blob as the only copy.
      try {
        await idb.clearStore(storeName);
      } catch {
        /* rows stay, but the flag is not set so they are never read */
      }
      secureStore.setListBackend(key, 'localstorage');
      secureStore.setCachedValue(key, blob);
      secureStore.markListHydrated(key);
      return 'failed';
    }
  };

  for (const key of [keys.students, keys.templates, keys.sessions]) {
    if (!key) continue;
    if (!secureStore.isListKey(key)) continue;
    if (secureStore.isEraseMarkerSet()) {
      await idb.clearAllListStores();
      secureStore.clearEraseMarker();
      secureStore.setListBackend(key, 'idb');
      secureStore.setCachedValue(key, '[]');
      secureStore.markListHydrated(key);
      results.push({ key, status: 'empty' });
      continue;
    }
    if (!idb.isIndexedDbSupported()) {
      secureStore.setListBackend(key, 'localstorage');
      secureStore.markListHydrated(key);
      results.push({ key, status: 'skipped-no-idb' });
      continue;
    }
    const storeName = secureStore.listStoreName(key)!;
    const idField = storeName === idb.LIST_STORES.sessions ? 'sessionId' : 'id';
    if (secureStore.getListBackend(key) === 'idb') {
      // A leftover blob means an earlier migration never finished: the blob is still the source
      // of truth, so migrate from it again instead of trusting partial rows.
      const rawBlob = rawLocalStorageGet(key);
      const plain = secureStore.getCachedValue(key) ?? rawBlob;
      if (rawBlob !== null && plain && plain !== '\u0000damaged' && isMigratableBlob(plain) && blobHasIds(plain, idField)) {
        results.push({ key, status: await migrateBlob(key, plain) });
        continue;
      }
      const durable = await secureStore.readDurableList(key);
      if (durable === undefined) {
        // A row that cannot be decrypted: the whole list stays unreadable, never written over.
        secureStore.markListUndecryptable(key);
        secureStore.markListHydrated(key);
        results.push({ key, status: 'skipped-corrupt' });
        continue;
      }
      secureStore.setCachedValue(key, JSON.stringify(durable));
      secureStore.markListHydrated(key);
      results.push({ key, status: 'already' });
      continue;
    }
    // LocalStorage backend: migrate the blob, or mark the list empty when there is none.
    const blob = secureStore.getItem(key);
    if (!blob) {
      secureStore.setListBackend(key, 'idb');
      secureStore.setCachedValue(key, '[]');
      secureStore.markListHydrated(key);
      results.push({ key, status: 'empty' });
      continue;
    }
    if (!isMigratableBlob(blob) || !blobHasIds(blob, idField)) {
      // Damaged blob: leave it exactly as stored; the list keeps localStorage and stays unreadable.
      secureStore.markListHydrated(key);
      results.push({ key, status: 'skipped-corrupt' });
      continue;
    }
    results.push({ key, status: await migrateBlob(key, blob) });
  }
  return results;
}

/** Students and templates are kept sorted by name, sessions newest first. */
export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
export const byDateDesc = (a: SessionData, b: SessionData) => compareSessionsOldestFirst(b, a);
