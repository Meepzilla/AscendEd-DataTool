// Device preferences that name a student or goal by id (see STUDENT_LINKED_PREF_KEYS in secure-store.ts).
//
// Without a passcode they live in localStorage like any other preference, so they survive a reload. With
// passcode protection on they are kept in memory for this visit only: an id is not a name, but it still ties
// this device to a student record, and plain storage can be read while the app is locked. Locking reloads the
// page, which clears them. A stored copy found while protection is on (written before it was turned on) is
// removed when it is read.

import { STUDENT_LINKED_PREF_KEYS, isPasscodeEnabled } from './secure-store';

export type StudentLinkedPrefKey = (typeof STUDENT_LINKED_PREF_KEYS)[number];

const memory = new Map<StudentLinkedPrefKey, string>();

function protectedOn(): boolean {
  try {
    return isPasscodeEnabled();
  } catch {
    // Unreadable passcode settings: keep ids out of plain storage.
    return true;
  }
}

export function readStudentLinkedPref(storageKey: StudentLinkedPrefKey): string | null {
  if (protectedOn()) {
    try { window.localStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
    return memory.get(storageKey) ?? null;
  }
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return memory.get(storageKey) ?? null;
  }
}

/** Saves the value (null removes it). Never throws: a preference that can't be kept just isn't remembered. */
export function writeStudentLinkedPref(storageKey: StudentLinkedPrefKey, value: string | null): void {
  if (value === null) memory.delete(storageKey);
  else memory.set(storageKey, value);
  try {
    if (value === null || protectedOn()) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, value);
  } catch {
    // Storage full or unavailable: kept in memory for this visit.
  }
}

/** Test helper: forgets the in-memory values. */
export function resetStudentLinkedPrefsForTests(): void {
  memory.clear();
}
