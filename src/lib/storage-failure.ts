// Unresolved storage failures, kept in one place so they can be shown until they are fixed —
// not just toasted once and forgotten. A save that silently falls back to "this visit only"
// (a full quota, private browsing, storage turned off) records a failure here; the next
// successful save of the same thing clears it. The record is in memory only: reloading the
// app clears it, which is right, because a reload re-reads the storage and either works
// (nothing was lost that the app can still see) or fails again and records a fresh failure.
//
// The detail text is plain language with no identifiers in it: storage keys hold only the
// constant local-guest-user id, and error messages can carry paths, so neither is shown.

export type StorageFailureSource =
  | 'draft'
  | 'student-groups'
  | 'abc-lists'
  | 'school-year'
  | 'theme'
  | 'safe-storage'
  | 'save';

export interface StorageFailure {
  source: StorageFailureSource;
  /** Short label for the thing that could not be saved. */
  label: string;
  /** Plain-language detail, with no identifiers. */
  detail: string;
  /** Whether the failure was the storage being full (rather than unavailable). */
  quota: boolean;
  /** When the failure was first recorded (milliseconds since the epoch). */
  at: number;
}

const LABELS: Record<StorageFailureSource, string> = {
  draft: 'Data Entry draft',
  'student-groups': 'Student groups',
  'abc-lists': 'ABC lists',
  'school-year': 'School year setting',
  theme: 'Theme',
  'safe-storage': 'A setting',
  save: 'A change',
};

const DETAILS: Record<StorageFailureSource, string> = {
  draft:
    'The draft could not be saved on this device, so unsaved entries are only kept on this screen. Save the sessions now to keep them.',
  'student-groups':
    'The student groups could not be saved on this device, so changes are only kept for this visit.',
  'abc-lists':
    'The ABC lists could not be saved on this device, so changes are only kept for this visit.',
  'school-year':
    'The school year could not be saved on this device, so it applies for this visit only.',
  theme: 'The theme could not be saved on this device, so it applies for this visit only.',
  'safe-storage':
    'A setting could not be saved on this device, so it applies for this visit only.',
  save: "The change could not be saved — this device's storage is full or unavailable. Back up your data in Settings, then delete old sessions to make room.",
};

/** Whether an error is the storage being full. */
export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  const message = error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? '');
  return /quota exceeded|storage is full|storage.*full/i.test(message);
}

const failures = new Map<StorageFailureSource, StorageFailure>();
const listeners = new Set<() => void>();
/** Stable snapshot for useSyncExternalStore: replaced only when the failures change. */
let snapshot: StorageFailure[] = [];

function emit() {
  snapshot = [...failures.values()];
  listeners.forEach(listener => listener());
}

/**
 * Records a failure. Returns true only when it is new for that source (nothing unresolved,
 * or the quota state changed), so callers can toast once per failure instead of once per save
 * attempt while storage stays full.
 */
export function reportStorageFailure(source: StorageFailureSource, error?: unknown): boolean {
  const quota = isQuotaError(error);
  const existing = failures.get(source);
  if (existing && existing.quota === quota) return false;
  failures.set(source, { source, label: LABELS[source], detail: DETAILS[source], quota, at: Date.now() });
  emit();
  return true;
}

/** Clears a source's failure, e.g. when its next save lands. */
export function clearStorageFailure(source: StorageFailureSource): void {
  if (!failures.delete(source)) return;
  emit();
}

/** The unresolved failures, oldest first. */
export function getStorageFailures(): StorageFailure[] {
  return snapshot;
}

/** One source's unresolved failure, or null. The same object until it is cleared or replaced. */
export function getStorageFailure(source: StorageFailureSource): StorageFailure | null {
  return failures.get(source) ?? null;
}

export function subscribeStorageFailures(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Which failure source a background write failure belongs to, from its storage key.
 * The Data Entry draft key carries the user id; groups and ABC lists have fixed prefixes.
 */
export function sourceForStorageKey(storageKey: string): StorageFailureSource {
  if (storageKey.startsWith('ascended_data_entry_draft_v1_')) return 'draft';
  if (storageKey.startsWith('ascended_student_groups_v1_')) return 'student-groups';
  if (storageKey === 'ascended_abc_lists') return 'abc-lists';
  return 'save';
}
