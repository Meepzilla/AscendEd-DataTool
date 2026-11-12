// Persistent attempt counting with escalating lockout, for the Access PIN and the passcode.
// Counts live in plain localStorage (one record per namespace), so a lockout survives a reload.
// A success clears the count; failures escalate: 1-4 no lockout, 5th locks 1 minute, 6th 5 minutes,
// 7th 15 minutes, 8th and later 60 minutes. The count is only cleared by a success, not by expiry,
// so a failure after a lockout has expired escalates from where the count left off.

const KEY_PREFIX = 'ascended_attempt_lockout_v1_';

interface AttemptRecord {
  failures: number;
  lastFailureAt: number;
}

function lockoutMsForFailures(failures: number): number {
  if (failures >= 8) return 60 * 60 * 1000;
  if (failures === 7) return 15 * 60 * 1000;
  if (failures === 6) return 5 * 60 * 1000;
  if (failures === 5) return 60 * 1000;
  return 0;
}

// In-memory fallback when localStorage is unavailable (e.g. private mode): the lockout still holds
// for this session, but does not survive a reload.
const memoryFallback = new Map<string, AttemptRecord>();

function readRecord(namespace: string): AttemptRecord | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + namespace);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AttemptRecord>;
    if (typeof parsed.failures !== 'number' || typeof parsed.lastFailureAt !== 'number') return null;
    return { failures: parsed.failures, lastFailureAt: parsed.lastFailureAt };
  } catch {
    return memoryFallback.get(namespace) ?? null;
  }
}

/**
 * The stored record, or the in-memory one when it is further along: when storage can be read but not written
 * (full), failures are counted in memory only, and reading storage alone would never see them.
 */
function currentRecord(namespace: string): AttemptRecord | null {
  const stored = readRecord(namespace);
  const memory = memoryFallback.get(namespace) ?? null;
  if (!memory) return stored;
  return !stored || memory.lastFailureAt >= stored.lastFailureAt ? memory : stored;
}

function writeRecord(namespace: string, record: AttemptRecord | null) {
  try {
    if (record) localStorage.setItem(KEY_PREFIX + namespace, JSON.stringify(record));
    else localStorage.removeItem(KEY_PREFIX + namespace);
    memoryFallback.delete(namespace);
  } catch {
    // localStorage unavailable; the in-memory record below still applies for this session.
    if (record) memoryFallback.set(namespace, record);
    else memoryFallback.delete(namespace);
  }
}

export function recordAttempt(namespace: string, success: boolean): void {
  if (success) {
    writeRecord(namespace, null);
    return;
  }
  const previous = currentRecord(namespace);
  writeRecord(namespace, {
    failures: (previous?.failures ?? 0) + 1,
    lastFailureAt: Date.now(),
  });
}

export function getLockoutRemainingMs(namespace: string, now: number = Date.now()): number {
  const record = currentRecord(namespace);
  if (!record) return 0;
  const remaining = record.lastFailureAt + lockoutMsForFailures(record.failures) - now;
  return remaining > 0 ? remaining : 0;
}

export function isLockedOut(namespace: string, now: number = Date.now()): boolean {
  return getLockoutRemainingMs(namespace, now) > 0;
}

export function clearAttempts(namespace: string): void {
  writeRecord(namespace, null);
}
