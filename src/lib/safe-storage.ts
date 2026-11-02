// localStorage that never throws: private browsing, storage turned off or a full quota just mean the value isn't
// read or saved, and the caller carries on with its default.

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves the value; false when it couldn't be saved. */
export function writeLocal(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
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
