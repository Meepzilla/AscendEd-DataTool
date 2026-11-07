// Multi-list transactions and multi-tab change detection for the three main lists
// (students, goal templates, sessions).
//
// The app stores each list as per-record rows in IndexedDB (or, for a list whose localStorage blob
// has not migrated, as one localStorage value). A multi-list change (delete a student and
// their sessions, import sessions, restore a backup) must not leave the lists half
// updated when storage fills up part way, so writes go through runListTransactionAsync:
// snapshot all three lists, write all three (each write resolves only after it has landed
// in durable storage), verify each one reads back from durable storage, and roll every
// list back to its snapshot when any step fails. State is only updated after it returns true.
//
// Multi-tab: lists in IndexedDB do not fire a storage event, so a successful save also posts
// on a BroadcastChannel (DATA_CHANGED_CHANNEL). The storage event is still listened for as
// well: it fires for the localStorage-backed lists and for storage being cleared. A channel
// message sent before the write lands would make the other tab reload a stale copy, so the
// message is only posted after the transaction (or single-list save) has been verified.

export type MainListKey = 'students' | 'goalTemplates' | 'sessions';

export const MAIN_LIST_KEYS: MainListKey[] = ['students', 'goalTemplates', 'sessions'];

/** BroadcastChannel name posted after a verified save of any of the three lists. */
export const DATA_CHANGED_CHANNEL = 'ascended-data-changed';

/**
 * Identifies this tab in data-changed messages. A BroadcastChannel message is delivered to every
 * other channel object with the same name, including a different channel object in the same tab,
 * so the listener must be able to tell its own tab's saves apart from another tab's.
 */
const TAB_ID: string = (() => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through to the random fallback below.
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
})();

/** Whether a received data-changed message was posted by this tab's own save. */
export function isOwnDataChangedMessage(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as { senderId?: unknown }).senderId === TAB_ID;
}

/** Posts a data-changed message for other tabs. Only call after the write has landed. */
export function postDataChanged() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel(DATA_CHANGED_CHANNEL).postMessage({ type: 'data-changed', senderId: TAB_ID, at: Date.now() });
    }
  } catch {
    // Another tab simply will not reload; this tab's data is still stored.
  }
}

export interface AsyncListTransactionStore {
  /** The stored value as it is, for rollback (e.g. secureStore.snapshotItem). */
  snapshot(key: MainListKey): unknown;
  /** Puts a snapshotted value back, resolving only after it has landed. */
  restore(key: MainListKey, snapshot: unknown): Promise<void>;
  /** Writes a list; false when it could not be stored. Resolves only after the write has landed. */
  write(key: MainListKey, value: unknown): Promise<boolean>;
  /** Reads a list back from durable storage (not the in-memory cache), for verification. */
  read(key: MainListKey): Promise<unknown>;
}

export interface ListTransactionInput {
  store: AsyncListTransactionStore;
  next: Record<MainListKey, unknown>;
}

/** JSON with object keys sorted, so the same records compare equal whatever their key order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter(k => record[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

/**
 * Writes all three lists and verifies each one reads back from durable storage as written. Returns
 * true only when all three hold the new values; on any write or verification failure every list
 * already written is put back to its snapshot (awaited) and false is returned. A failed verify
 * reads through durable storage, so it catches a write that never reached disk, not just a
 * rejected one.
 *
 * There is no synchronous version: a synchronous write cannot know whether the data reached disk,
 * which is the failure this helper exists to prevent.
 */
export async function runListTransactionAsync({ store, next }: ListTransactionInput): Promise<boolean> {
  const snapshots = new Map<MainListKey, unknown>();
  for (const key of MAIN_LIST_KEYS) {
    try {
      snapshots.set(key, store.snapshot(key));
    } catch {
      snapshots.set(key, undefined);
    }
  }
  const written: MainListKey[] = [];
  const rollback = async () => {
    for (const key of [...written].reverse()) {
      try {
        await store.restore(key, snapshots.get(key));
      } catch {
        // Best effort: the earlier value fit before, so it fits again.
      }
    }
  };
  for (const key of MAIN_LIST_KEYS) {
    let ok = false;
    try {
      ok = await store.write(key, next[key]);
    } catch {
      ok = false;
    }
    if (!ok) {
      await rollback();
      return false;
    }
    written.push(key);
    let readBack: unknown;
    try {
      readBack = await store.read(key);
    } catch {
      await rollback();
      return false;
    }
    if (stableStringify(readBack) !== stableStringify(next[key])) {
      await rollback();
      return false;
    }
  }
  return true;
}

export interface MainListStorageKeys {
  students: string | null;
  templates: string | null;
  sessions: string | null;
}

/**
 * Whether a storage event came from another tab changing one of the three main lists.
 * A null key means storage was cleared, which also changes the lists. Anything else
 * (theme, ABC lists, groups) is not one of the three lists.
 */
export function isMainListStorageKey(key: string | null, keys: MainListStorageKeys): boolean {
  if (key === null) return true;
  return key === keys.students || key === keys.templates || key === keys.sessions;
}
