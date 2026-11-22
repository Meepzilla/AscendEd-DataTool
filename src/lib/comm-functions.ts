import { z } from 'zod';
import * as secureStore from './secure-store';
import { clearStorageFailure, reportStorageFailure } from './storage-failure';
import { DEFAULT_COMM_FUNCTIONS, isSafeCommFunctionKey, registerCommFunctionLoader, type CommFunction } from './goal-constants/communication';

// The communicative functions offered for Communication Functions goals, editable in Settings (like the ABC lists).
// Only a list the user changed is stored; it goes through secure-store, so with passcode protection on it is
// encrypted like the student data, and it is included in backups. Session data is stored by each function's key,
// so a function is never deleted, only hidden: past sessions keep their counts and names. A stored list that can't
// be read is shown as the defaults and never written over (only a restore replaces it).

export const COMM_FUNCTIONS_KEY = 'ascended_comm_functions';
const CHANGE_EVENT = 'ascended-comm-functions-change';
const DAMAGED_MESSAGE = 'The saved communication functions could not be read, so they were not changed. Restore a backup in Settings to replace them.';
/** The most functions the list can hold (hidden ones included). */
export const MAX_COMM_FUNCTIONS = 40;
export const MAX_COMM_FUNCTION_LABEL = 60;

export const CommFunctionsSchema = z.array(z.object({
  key: z.string().refine(isSafeCommFunctionKey, 'A function key must start with a letter and use only letters, digits and "_".'),
  label: z.string().trim().min(1).max(MAX_COMM_FUNCTION_LABEL),
  hidden: z.boolean().optional(),
})).min(1).max(MAX_COMM_FUNCTIONS)
  .refine(list => new Set(list.map(f => f.key)).size === list.length, 'Each function needs its own key.')
  .refine(list => list.some(f => !f.hidden), 'At least one function must be shown.');

/** The list saved on this device, or null when it has never been changed. */
export function loadCustomCommFunctions(): CommFunction[] | null {
  try {
    const stored = secureStore.getItem(COMM_FUNCTIONS_KEY);
    if (!stored || stored === '\u0000damaged') return null;
    const parsed = CommFunctionsSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function loadCommFunctions(): CommFunction[] {
  return loadCustomCommFunctions() ?? DEFAULT_COMM_FUNCTIONS;
}

// Report charts, narratives and Data Entry read the list through goal-constants.
registerCommFunctionLoader(loadCommFunctions);

export function isCommFunctionsDamaged(): boolean {
  return secureStore.isUndecryptable(COMM_FUNCTIONS_KEY);
}

/** Saves the list; null goes back to the defaults. Refuses when the saved list couldn't be read. */
export function saveCommFunctions(list: CommFunction[] | null) {
  if (isCommFunctionsDamaged()) throw new Error(DAMAGED_MESSAGE);
  saveNow(list);
}

/** Saves the list even when the saved one couldn't be read: a restore replacing damaged data. */
export function saveCommFunctionsForRestore(list: CommFunction[] | null) {
  secureStore.clearUndecryptable(COMM_FUNCTIONS_KEY);
  saveNow(list);
}

function saveNow(list: CommFunction[] | null) {
  if (list) {
    const parsed = CommFunctionsSchema.safeParse(list);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'The communication functions list is not valid.');
  }
  try {
    // The defaults themselves are never stored, so the app's own list (and later improvements to it) applies.
    if (list && JSON.stringify(list) !== JSON.stringify(DEFAULT_COMM_FUNCTIONS)) secureStore.setItem(COMM_FUNCTIONS_KEY, JSON.stringify(list));
    else secureStore.removeItem(COMM_FUNCTIONS_KEY);
    secureStore.afterStored(COMM_FUNCTIONS_KEY, () => clearStorageFailure('comm-functions'));
  } catch (error) {
    if (error instanceof Error && error.message === 'Locked') throw error;
    reportStorageFailure('comm-functions', error);
    throw new Error('The communication functions could not be saved on this device (storage is full or unavailable). They are only kept for this visit.');
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onCommFunctionsChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== COMM_FUNCTIONS_KEY && event.key !== null) return;
    void secureStore.refreshFromStorage(COMM_FUNCTIONS_KEY).then(() => listener());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** A new, unused key for a function named `label` (data is stored under it, so it never changes). */
export function newCommFunctionKey(label: string, list: CommFunction[]): string {
  const words = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 4);
  const base = `c_${words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('') || 'function'}`.slice(0, 50);
  const taken = new Set(list.map(f => f.key));
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
  return key;
}

/** Everything in `current`, followed by the functions from `incoming` it doesn't have (matched by key). */
export function mergeCommFunctions(current: CommFunction[], incoming: CommFunction[]): CommFunction[] {
  const keys = new Set(current.map(f => f.key));
  return [...current, ...incoming.filter(f => !keys.has(f.key))].slice(0, MAX_COMM_FUNCTIONS);
}
