// Multi-list transactions and multi-tab change detection for the three main lists
// (students, goal templates, sessions).
//
// The app stores each list as one whole blob. A multi-list change (delete a student and
// their sessions, import sessions, restore a backup) must not leave the lists half
// updated when storage fills up part way, so writes go through runListTransaction:
// snapshot all three lists, write all three, verify each one reads back, and roll every
// list back to its snapshot when any step fails.
//
// Multi-tab: only the storage event is used, not a BroadcastChannel. Every list reaches
// localStorage (templates directly, students and sessions through the encrypted persist),
// so another tab's save fires a storage event here. A channel message sent before the
// encrypted write lands would make the other tab reload a stale copy, so nothing is
// posted; the event after the write lands is the signal. On an external change the
// lists are reloaded from storage as they are, with no merge attempt.

export type MainListKey = 'students' | 'goalTemplates' | 'sessions';

export const MAIN_LIST_KEYS: MainListKey[] = ['students', 'goalTemplates', 'sessions'];

export interface ListTransactionStore {
  /** The stored value as it is, for rollback (e.g. secureStore.snapshotItem). */
  snapshot(key: MainListKey): unknown;
  /** Puts a snapshotted value back. */
  restore(key: MainListKey, snapshot: unknown): void;
  /** Writes a list; false when it could not be stored. */
  write(key: MainListKey, value: unknown): boolean;
  /** Reads a list back from storage, for verification. */
  read(key: MainListKey): unknown;
}

export interface ListTransactionInput {
  store: ListTransactionStore;
  next: Record<MainListKey, unknown>;
}

/**
 * Writes all three lists and verifies each one reads back as written. Returns true only
 * when all three hold the new values; on any write or verification failure every list
 * already written is put back to its snapshot and false is returned. A failed verify
 * reads through the same path the app reads (the in-memory cache when passcode
 * protection is on), so it catches a rejected write, not a later disk failure.
 */
export function runListTransaction({ store, next }: ListTransactionInput): boolean {
  const snapshots = new Map<MainListKey, unknown>();
  for (const key of MAIN_LIST_KEYS) {
    try {
      snapshots.set(key, store.snapshot(key));
    } catch {
      snapshots.set(key, undefined);
    }
  }
  const written: MainListKey[] = [];
  const rollback = () => {
    for (const key of [...written].reverse()) {
      try {
        store.restore(key, snapshots.get(key));
      } catch {
        // Best effort: the earlier value fit before, so it fits again.
      }
    }
  };
  for (const key of MAIN_LIST_KEYS) {
    let ok = false;
    try {
      ok = store.write(key, next[key]);
    } catch {
      ok = false;
    }
    if (!ok) {
      rollback();
      return false;
    }
    written.push(key);
    let readBack: unknown;
    try {
      readBack = store.read(key);
    } catch {
      rollback();
      return false;
    }
    if (JSON.stringify(readBack) !== JSON.stringify(next[key])) {
      rollback();
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
