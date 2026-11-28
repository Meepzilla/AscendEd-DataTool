// The teacher's PIN for turning off the Student Access Lock on Data Entry. Only a hash is kept, on this device.
//
// The PIN gates unsaved Data Entry edits only. It does not hide student names or cards, and it does not
// protect saved data; that is the passcode's job (see src/lib/secure-store.ts).
//
// Stored format: `pbkdf2:v1:<iterations>:<base64 salt>:<base64 hash>`, PBKDF2-SHA-256 with a random
// 16-byte per-device salt and 100,000 iterations. The salt travels with the hash so the value is
// self-describing. Comparison is constant-time over equal-length byte arrays (see below).
//
// Older versions stored an unsalted SHA-256 hex value or a `djb2:<hex>` value. Either can be reversed in
// moments for a 4 to 8 digit PIN by anyone who can read localStorage, so they are no longer accepted: a
// stored value in any format other than the one above counts as no PIN and is removed when it is next
// read. The teacher chooses a new PIN the next time they turn the lock on (the lock itself is not kept
// across a reload, so nobody is left locked out). Without Web Crypto, setting a PIN fails instead of
// storing a weak hash.

import { clearAttempts, isLockedOut, recordAttempt } from './attempt-lockout';

const PIN_KEY = 'ascended_access_pin_v1_';
const LOCKOUT_NAMESPACE = 'access-pin';

export const PIN_PATTERN = /^\d{4,8}$/;

const ITERATIONS = 100_000;
/** The most PBKDF2 iterations a stored PIN may name (a clear multiple of ITERATIONS, with room to raise it). */
const MAX_PIN_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

function hasSubtle(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

/**
 * Compares equal-length byte arrays with an XOR accumulator and no early exit on mismatch, so the
 * time taken does not depend on where the values first differ. Honest limit: JavaScript cannot
 * guarantee true constant time (JIT compilation, garbage collection, and timer granularity all add
 * data-independent noise), so this is best-effort — it removes the early-exit leak, it does not make
 * the comparison provably timing-free. Lengths are checked first; a length difference is not a secret
 * here (all hashes of one scheme are the same length).
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const pinText = (uid: string, pin: string) => `ascended-access-lock:${uid}:${pin}`;

async function hashPinNew(uid: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pinText(uid, pin)), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, HASH_BYTES * 8));
  return `pbkdf2:v1:${ITERATIONS}:${b64(salt)}:${b64(derived)}`;
}

const CURRENT_PREFIX = 'pbkdf2:v1:';

/** The stored value, or null when there is none. A value in an old, weak format is removed and counts as none. */
function readStoredPin(uid: string): string | null {
  const storageKey = PIN_KEY + uid;
  const stored = localStorage.getItem(storageKey);
  if (stored === null) return null;
  if (stored.startsWith(CURRENT_PREFIX)) return stored;
  try { localStorage.removeItem(storageKey); } catch { /* left in place; still never accepted */ }
  return null;
}

/** Verifies a PIN against a stored PBKDF2 value. Returns false for anything else. */
async function verifyStored(uid: string, pin: string, stored: string): Promise<boolean> {
  if (!stored.startsWith(CURRENT_PREFIX) || !hasSubtle()) return false;
  const parts = stored.split(':');
  const iterations = Number(parts[2]);
  // Both come from storage and PBKDF2 runs them as given: a huge count would hang every PIN check, a huge length
  // would ask for an enormous derived key. Anything outside what this app writes (with room to raise the count)
  // is treated as not matching.
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > MAX_PIN_ITERATIONS || parts.length !== 5) return false;
  try {
    const salt = unb64(parts[3]);
    const expected = unb64(parts[4]);
    if (expected.length < 16 || expected.length > 64) return false;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pinText(uid, pin)), 'PBKDF2', false, ['deriveBits']);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, expected.length * 8));
    return constantTimeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hasAccessPin(uid: string | undefined): boolean {
  try {
    return readStoredPin(uid || 'guest') !== null;
  } catch {
    return false;
  }
}

export async function setAccessPin(uid: string | undefined, pin: string): Promise<boolean> {
  if (!PIN_PATTERN.test(pin)) return false;
  // No Web Crypto means no PBKDF2: fail rather than store a weak hash.
  if (!hasSubtle()) return false;
  try {
    localStorage.setItem(PIN_KEY + (uid || 'guest'), await hashPinNew(uid || 'guest', pin));
    clearAttempts(LOCKOUT_NAMESPACE);
    return true;
  } catch {
    return false;
  }
}

export async function checkAccessPin(uid: string | undefined, pin: string): Promise<boolean> {
  // Locked out: fail immediately, without recording another failure (a locked-out attempt must not
  // extend the lockout) and without spending a PBKDF2 derivation.
  if (isLockedOut(LOCKOUT_NAMESPACE)) return false;
  try {
    const stored = readStoredPin(uid || 'guest');
    if (!stored) return false;
    const ok = await verifyStored(uid || 'guest', pin, stored);
    if (!ok) {
      recordAttempt(LOCKOUT_NAMESPACE, false);
      return false;
    }
    recordAttempt(LOCKOUT_NAMESPACE, true);
    return true;
  } catch {
    return false;
  }
}

export function clearAccessPin(uid: string | undefined) {
  try {
    localStorage.removeItem(PIN_KEY + (uid || 'guest'));
    clearAttempts(LOCKOUT_NAMESPACE);
  } catch {
    // Nothing stored.
  }
}
