// IndexedDB persistence for the three main lists (students, goal templates, sessions).
//
// No new dependency: this is a small typed wrapper over the platform IndexedDB API.
// Each list lives in its own object store and each record is one row, so saving one
// student no longer rewrites the whole list as a single localStorage blob.
//
// A row is { k, v, o }: k is the record id (student/template id, sessionId for
// sessions), v is the stored string for that record (the record's JSON, encrypted
// with the passcode when protection is on, plaintext when it is off — encryption
// stays in secure-store, this file only stores strings), and o is the record's
// position in the list, so reading the rows back returns the list in its order
// (IndexedDB key order would be id order, which is not the list order).
//
// When IndexedDB is unavailable (server rendering, the node test environment) the
// wrapper falls back to an in-memory store with the same semantics. That fallback
// is only for those environments: the migration code never moves real user data
// into it — without a real IndexedDB the lists stay in localStorage (see
// list-migration in data-store.ts). Tests opt into the memory store explicitly
// with useMemoryIndexedDb().

export interface IdRecord {
  /** Record id. */
  k: string;
  /** Stored string for the record. */
  v: string;
  /** Position in the list. */
  o: number;
}

export const DB_NAME = 'ascended-datatool';
export const DB_VERSION = 1;

export const LIST_STORES = {
  students: 'students',
  goalTemplates: 'goalTemplates',
  sessions: 'sessions',
} as const;

export type ListStoreName = (typeof LIST_STORES)[keyof typeof LIST_STORES];

const META_STORE = 'meta';

/** Test-only switch: use the in-memory store even where IndexedDB exists. */
let memoryMode = false;
/** Test-only switch: make the next writes fail, to test durability handling. */
let failWrites = false;

const memoryStores = new Map<string, Map<string, IdRecord>>();
const memoryMeta = new Map<string, unknown>();

/** Enables the in-memory store (tests only). */
export function useMemoryIndexedDb() {
  memoryMode = true;
}

/** Clears the in-memory store (tests only). */
export function resetMemoryIndexedDb() {
  memoryStores.clear();
  memoryMeta.clear();
  failWrites = false;
  failReads = 0;
}

/** Makes writes throw a QuotaExceededError until turned off (tests only). */
export function setIndexedDbWriteFailure(fail: boolean) {
  failWrites = fail;
}

// Test hook: makes reads fail the next `count` times (like iPad Safari's "connection to Indexed Database server lost").
let failReads = 0;
export function setIndexedDbReadFailures(count: number) {
  failReads = count;
}

export function isIndexedDbSupported(): boolean {
  return memoryMode || (typeof indexedDB !== 'undefined' && indexedDB !== null);
}

function memoryStore(name: string): Map<string, IdRecord> {
  let store = memoryStores.get(name);
  if (!store) {
    store = new Map();
    memoryStores.set(name, store);
  }
  return store;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Object.values(LIST_STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function withStore<T>(name: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(name, mode);
    const result = await fn(tx.objectStore(name));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    return result;
  } finally {
    db.close();
  }
}

/** Writes rows (replacing any row with the same key). Resolves only after the transaction commits. */
export async function putRecords(storeName: ListStoreName, records: IdRecord[]): Promise<void> {
  if (failWrites) throw new DOMException('Storage is full', 'QuotaExceededError');
  if (memoryMode) {
    const store = memoryStore(storeName);
    for (const record of records) store.set(record.k, record);
    return;
  }
  await withStore(storeName, 'readwrite', async store => {
    for (const record of records) await runRequest(store.put(record));
  });
}

/** Deletes rows by key. */
export async function deleteRecords(storeName: ListStoreName, keys: string[]): Promise<void> {
  if (memoryMode) {
    const store = memoryStore(storeName);
    for (const key of keys) store.delete(key);
    return;
  }
  await withStore(storeName, 'readwrite', async store => {
    for (const key of keys) await runRequest(store.delete(key));
  });
}

/** All rows in list order. */
export async function getAllRecords(storeName: ListStoreName): Promise<IdRecord[]> {
  if (failReads > 0) {
    failReads--;
    throw new Error('Connection to Indexed Database server lost. Refresh the page to try again');
  }
  if (memoryMode) return [...memoryStore(storeName).values()].sort((a, b) => a.o - b.o);
  const rows = await withStore(storeName, 'readonly', store => runRequest(store.getAll() as IDBRequest<IdRecord[]>));
  return [...rows].sort((a, b) => a.o - b.o);
}

/** How many rows the store holds. */
export async function getRecordCount(storeName: ListStoreName): Promise<number> {
  if (memoryMode) return memoryStore(storeName).size;
  return withStore(storeName, 'readonly', store => runRequest(store.count()));
}

/** Removes every row in the store. */
export async function clearStore(storeName: ListStoreName): Promise<void> {
  if (memoryMode) {
    memoryStore(storeName).clear();
    return;
  }
  await withStore(storeName, 'readwrite', store => runRequest(store.clear()));
}

/** Removes every row in all three list stores. */
export async function clearAllListStores(): Promise<void> {
  for (const name of Object.values(LIST_STORES)) await clearStore(name);
}

export async function getMeta(key: string): Promise<unknown> {
  if (memoryMode) return memoryMeta.get(key) ?? null;
  return withStore(META_STORE, 'readonly', store => runRequest(store.get(key))).then(
    (row: unknown) => (row as { value?: unknown } | undefined)?.value ?? null,
  );
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (memoryMode) {
    memoryMeta.set(key, value);
    return;
  }
  await withStore(META_STORE, 'readwrite', store => runRequest(store.put({ key, value })));
}
