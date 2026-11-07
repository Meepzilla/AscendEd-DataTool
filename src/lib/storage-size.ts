// Storage size: how much the app has stored, and when to warn about it.
//
// The three lists used to live as whole blobs in localStorage (about a 5 MB
// quota, shared with every other key). They now live as per-record rows in
// IndexedDB, where the quota is much larger and per-origin, but the data can
// still outgrow the device, so the app measures what it holds and warns before
// a save fails instead of after.

export const STORAGE_WARN_BYTES = 3 * 1024 * 1024;
export const QUOTA_WARN_RATIO = 0.7;
export const QUOTA_CRITICAL_RATIO = 0.9;

export type StorageLevel = 'ok' | 'warn' | 'critical';

export interface StorageEstimate {
  /** Bytes stored for this origin (IndexedDB + localStorage + caches). */
  bytes: number;
  /** Quota in bytes, when the browser reports one. */
  quota: number | null;
  /** bytes / quota as a percentage, when the quota is known. */
  percent: number | null;
  /** Whether the stored total passes 3 MB (warned about even without a quota). */
  over3MB: boolean;
  /** warn at 70% of quota, critical at 90%. */
  level: StorageLevel;
  /** Where the numbers came from: the browser estimate, or the fallback sum. */
  source: 'estimate' | 'fallback';
}

/** "1.5 MB", "832 KB", "42 B". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** warn at 70% of quota, critical at 90%; 'ok' when no quota is known. */
export function storageLevel(bytes: number, quota: number | null): StorageLevel {
  if (!quota || quota <= 0) return 'ok';
  const ratio = bytes / quota;
  if (ratio >= QUOTA_CRITICAL_RATIO) return 'critical';
  if (ratio >= QUOTA_WARN_RATIO) return 'warn';
  return 'ok';
}

export function toStorageEstimate(bytes: number, quota: number | null, source: StorageEstimate['source']): StorageEstimate {
  return {
    bytes,
    quota,
    percent: quota && quota > 0 ? (bytes / quota) * 100 : null,
    over3MB: bytes > STORAGE_WARN_BYTES,
    level: storageLevel(bytes, quota),
    source,
  };
}

/**
 * How much this origin has stored. Prefers navigator.storage.estimate(); when
 * the browser has none (or it fails), sums what the app can count itself via
 * fallbackBytes (localStorage entries plus the IndexedDB rows secure-store has
 * persisted) and reports no quota.
 */
export async function estimateStorage(fallbackBytes?: () => number): Promise<StorageEstimate> {
  try {
    const estimate = (globalThis as { navigator?: { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> } } }).navigator?.storage?.estimate;
    if (estimate) {
      const result = await estimate();
      if (typeof result.usage === 'number') {
        return toStorageEstimate(result.usage, typeof result.quota === 'number' ? result.quota : null, 'estimate');
      }
    }
  } catch {
    // Fall through to the fallback sum below.
  }
  return toStorageEstimate(fallbackBytes?.() ?? 0, null, 'fallback');
}

/** Bytes of a list as it would be stored (its JSON, UTF-8). */
export function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export interface SaveSizeCheck {
  /** Whether the save fits in the quota (or under the localStorage cap when no quota is known). */
  fits: boolean;
  /** Projected stored total after this save. */
  projectedBytes: number;
  /** Whether the projected total passes 3 MB. */
  over3MB: boolean;
}

/**
 * Size check run before a save: the stored total after this write, against the
 * quota when the browser reports one, else against the ~5 MB localStorage cap
 * for localStorage-backed keys (IndexedDB-backed keys have no such cap, so
 * they only get the 3 MB warning). currentKeyBytes is what this key holds now,
 * so replacing a list does not double-count it.
 */
export async function checkSaveFits(
  newBytes: number,
  currentKeyBytes: number,
  options: { isIndexedDbBacked: boolean; fallbackBytes?: () => number } = { isIndexedDbBacked: false },
): Promise<SaveSizeCheck> {
  const estimate = await estimateStorage(options.fallbackBytes);
  const projectedBytes = estimate.bytes + Math.max(0, newBytes - currentKeyBytes);
  let fits = true;
  if (estimate.quota) {
    fits = projectedBytes <= estimate.quota;
  } else if (!options.isIndexedDbBacked) {
    fits = projectedBytes <= 5 * 1024 * 1024;
  }
  return { fits, projectedBytes, over3MB: projectedBytes > STORAGE_WARN_BYTES };
}

let persistRequested = false;

/**
 * Asks the browser to keep this app's storage (IndexedDB and localStorage) even when the device runs low on
 * space, instead of clearing it like a cache. Once per visit; the browser may say no (that is not an error),
 * and a backup is still the only protection against the device being lost or the app deleted.
 */
export function requestPersistentStorage() {
  if (persistRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistRequested = true;
  navigator.storage.persisted?.()
    .then(already => (already ? true : navigator.storage.persist()))
    .catch(() => { /* not available here */ });
}
