import * as secureStore from './secure-store';
import { clearStorageFailure, reportStorageFailure } from './storage-failure';
import {
  ABC_ANTECEDENTS, ABC_BEHAVIORS, ABC_CONSEQUENCES, ABC_REPLACEMENT_BEHAVIOR, BEHAVIOR_FUNCTIONS, type BehaviorFunction,
} from './goal-constants/behavior';

// The choices shown when recording ABC data, editable in Settings. They are stored on this device and
// included in backups. "Used replacement skill" is always the first behavior and isn't part of the list.
//
// Custom lists go through secure-store, so with passcode protection on they are encrypted like the
// student data instead of sitting in localStorage as plaintext. The defaults themselves are public
// content shipped in the app; only a list the user changed is stored, and only that stored list is
// encrypted. A stored list that can't be read is shown as the defaults and never written over — only
// a restore replaces it.

export interface AbcLists {
  antecedents: string[];
  behaviors: string[];
  consequences: { label: string; fn: BehaviorFunction | null }[];
}

export const DEFAULT_ABC_LISTS: AbcLists = {
  antecedents: [...ABC_ANTECEDENTS],
  behaviors: ABC_BEHAVIORS.filter(b => b !== ABC_REPLACEMENT_BEHAVIOR),
  consequences: ABC_CONSEQUENCES.map(c => ({ ...c })),
};

const VALID_FUNCTIONS = new Set<string>(BEHAVIOR_FUNCTIONS);

function parseAbcItem(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length >= 1 && trimmed.length <= 60 ? trimmed : null;
}

/** Validates and normalizes an ABC lists object without pulling Zod into runtime pages. */
export function parseAbcLists(raw: unknown): AbcLists | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.antecedents) || !Array.isArray(obj.behaviors) || !Array.isArray(obj.consequences)) return null;
  const antecedents: string[] = [];
  for (const x of obj.antecedents) {
    const v = parseAbcItem(x);
    if (v === null) return null;
    antecedents.push(v);
  }
  const behaviors: string[] = [];
  for (const x of obj.behaviors) {
    const v = parseAbcItem(x);
    if (v === null) return null;
    behaviors.push(v);
  }
  const consequences: AbcLists['consequences'] = [];
  for (const x of obj.consequences) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const item = x as Record<string, unknown>;
    const label = parseAbcItem(item.label);
    if (label === null) return null;
    if (item.fn !== null && (typeof item.fn !== 'string' || !VALID_FUNCTIONS.has(item.fn))) return null;
    consequences.push({ label, fn: item.fn as BehaviorFunction | null });
  }
  return { antecedents, behaviors, consequences };
}

export const ABC_LISTS_KEY = 'ascended_abc_lists';
const CHANGE_EVENT = 'ascended-abc-lists-change';
const DAMAGED_MESSAGE = 'The saved ABC lists could not be read, so they were not changed. Restore a backup in Settings to replace them.';

/** The lists saved on this device, or null if they've never been changed. */
export function loadCustomAbcLists(): AbcLists | null {
  try {
    const stored = secureStore.getItem(ABC_LISTS_KEY);
    if (!stored || stored === '\u0000damaged') return null;
    return parseAbcLists(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function loadAbcLists(): AbcLists {
  return loadCustomAbcLists() ?? DEFAULT_ABC_LISTS;
}

/** Whether the saved ABC lists couldn't be read: shown as the defaults, never written over. */
export function isAbcListsDamaged(): boolean {
  return secureStore.isUndecryptable(ABC_LISTS_KEY);
}

/** Saves the lists; null goes back to the defaults. Refuses when the saved lists couldn't be read. */
export function saveAbcLists(lists: AbcLists | null) {
  if (isAbcListsDamaged()) throw new Error(DAMAGED_MESSAGE);
  saveAbcListsNow(lists);
}

/** Saves the lists even when the saved ones couldn't be read: a restore replacing damaged data. */
export function saveAbcListsForRestore(lists: AbcLists | null) {
  secureStore.clearUndecryptable(ABC_LISTS_KEY);
  saveAbcListsNow(lists);
}

function saveAbcListsNow(lists: AbcLists | null) {
  try {
    if (lists) secureStore.setItem(ABC_LISTS_KEY, JSON.stringify(lists));
    else secureStore.removeItem(ABC_LISTS_KEY);
    // Cleared once actually stored (with protection on the write finishes in the background).
    secureStore.afterStored(ABC_LISTS_KEY, () => clearStorageFailure('abc-lists'));
  } catch (error) {
    // Locked (passcode on, not unlocked) is not a storage failure: keep the original error.
    if (error instanceof Error && error.message === 'Locked') throw error;
    // A failed save used to be silent ("the lists just aren't kept"). It is recorded (persistent
    // warning) and thrown, so the settings card — or a restore, through its onError — can say so.
    reportStorageFailure('abc-lists', error);
    throw new Error('The ABC lists could not be saved on this device (storage is full or unavailable). They are only kept for this visit.');
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onAbcListsChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ABC_LISTS_KEY && event.key !== null) return;
    // Another tab changed the lists: the in-memory cache is stale until the stored value is read back.
    void secureStore.refreshFromStorage(ABC_LISTS_KEY).then(() => listener());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Everything in `current`, followed by the items from `incoming` it doesn't have. */
export function mergeAbcLists(current: AbcLists, incoming: AbcLists): AbcLists {
  const union = (a: string[], b: string[]) => [...a, ...b.filter(x => !a.includes(x))];
  const labels = current.consequences.map(c => c.label);
  return {
    antecedents: union(current.antecedents, incoming.antecedents),
    behaviors: union(current.behaviors, incoming.behaviors),
    consequences: [...current.consequences, ...incoming.consequences.filter(c => !labels.includes(c.label))],
  };
}
