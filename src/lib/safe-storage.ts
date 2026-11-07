// localStorage that never throws: private browsing, storage turned off or a full quota just mean the value isn't
// read or saved, and the caller carries on with its default.
//
// "Never throws" used to also mean "never tells anyone": a failed write was invisible, so a setting the user
// changed (theme, school year, onboarding flags) silently reverted next visit. A failed read or write now
// records a failure in storage-failure.ts (shown as a persistent warning until storage works again), and a
// failed write also notifies the handler the app registers, so it can toast once. The return value still
// says whether the write landed, for callers that check it.

import { clearStorageFailure, getStorageFailure, reportStorageFailure, type StorageFailure } from './storage-failure';

export type SafeStorageErrorHandler = (failure: StorageFailure) => void;

let onSafeStorageError: SafeStorageErrorHandler | null = null;

/** Called (once per failure) when a setting could not be saved, so the app can toast and log it. */
export function setSafeStorageErrorHandler(handler: SafeStorageErrorHandler | null) {
  onSafeStorageError = handler;
}

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    // The default is used for this visit; the persistent warning says the setting wasn't kept.
    reportStorageFailure('safe-storage', error);
    return null;
  }
}

/** Saves the value; false when it couldn't be saved. */
export function writeLocal(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    clearStorageFailure('safe-storage');
    return true;
  } catch (error) {
    if (reportStorageFailure('safe-storage', error)) {
      const failure = getStorageFailure('safe-storage');
      if (failure) onSafeStorageError?.(failure);
    }
    return false;
  }
}

export function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
