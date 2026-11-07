// The teacher's PIN for turning off the Student Access Lock on Data Entry. Only a hash is kept, on this device.
//
// The PIN gates unsaved Data Entry edits only. It does not hide student names or cards, and it does not
// protect saved data; that is the passcode's job (see src/lib/secure-store.ts).
//
// Stored format: `pbkdf2:v1:<iterations>:<base64 salt>:<base64 hash>`, PBKDF2-SHA-256 with a random
// 16-byte per-device salt and 100,000 iterations. The salt travels with the hash so the value is
// self-describing. Comparison is constant-time over equal-length byte arrays (see below).
//
// Legacy values (a single SHA-256 hex string, or a `djb2:<hex>` value from insecure origins) are still
// verified, and a successful check transparently re-hashes the PIN into the new scheme. No new djb2
// hash is ever created: without Web Crypto, setting a PIN fails instead of storing a weak hash.
// Without Web Crypto the upgrade is deferred (PBKDF2 needs crypto.subtle), the legacy value is left
// untouched, and only a djb2 legacy value can still be verified — a legacy SHA-256 value cannot be
// checked without crypto.subtle, exactly as before. A later visit with Web Crypto available can still
// verify the legacy value and upgrade it then.

import { clearAttempts, isLockedOut, recordAttempt } from './attempt-lockout';

const PIN_KEY = 'ascended_access_pin_v1_';
const LOCKOUT_NAMESPACE = 'access-pin';

export const PIN_PATTERN = /^\d{4,8}$/;

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = (text: string) => Uint8Array.from(text.match(/../g) ?? [], pair => parseInt(pair, 16));

function hasSubtle(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return hex(new Uint8Array(digest));
}

function djb2Hex(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(16);
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

function isLegacyFormat(stored: string): boolean {
  return stored.startsWith('djb2:') || /^[0-9a-f]{64}$/.test(stored);
}

/** Verifies a PIN against a stored value of any known format. Returns false for unknown formats. */
async function verifyStored(uid: string, pin: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:v1:')) {
    if (!hasSubtle()) return false;
    const parts = stored.split(':');
    const iterations = Number(parts[2]);
    if (!Number.isInteger(iterations) || iterations <= 0 || parts.length !== 5) return false;
    try {
      const salt = unb64(parts[3]);
      const expected = unb64(parts[4]);
      const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pinText(uid, pin)), 'PBKDF2', false, ['deriveBits']);
      const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, expected.length * 8));
      return constantTimeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  if (stored.startsWith('djb2:')) {
    // Legacy insecure-origin fallback. Verified only so an existing PIN can be upgraded (see below);
    // a new djb2 hash is never created.
    return constantTimeEqual(new TextEncoder().encode(djb2Hex(pinText(uid, pin))), new TextEncoder().encode(stored.slice('djb2:'.length)));
  }
  if (/^[0-9a-f]{64}$/.test(stored)) {
    // Legacy single SHA-256, unsalted. Needs Web Crypto; without it this cannot be checked.
    if (!hasSubtle()) return false;
    return constantTimeEqual(unhex(await sha256Hex(pinText(uid, pin))), unhex(stored));
  }
  return false;
}

export function hasAccessPin(uid: string | undefined): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY + (uid || 'guest'));
  } catch {
    return false;
  }
}

export async function setAccessPin(uid: string | undefined, pin: string): Promise<boolean> {
  // No Web Crypto means no PBKDF2: fail rather than store a weak hash (the old djb2 fallback is gone).
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
    const stored = localStorage.getItem(PIN_KEY + (uid || 'guest'));
    if (!stored) return false;
    const ok = await verifyStored(uid || 'guest', pin, stored);
    if (!ok) {
      recordAttempt(LOCKOUT_NAMESPACE, false);
      return false;
    }
    recordAttempt(LOCKOUT_NAMESPACE, true);
    if (isLegacyFormat(stored)) {
      // Transparent migration: the PIN just proved correct, so re-hash it into the new scheme.
      // If Web Crypto is unavailable setAccessPin fails and the legacy value is left in place,
      // so a later visit with Web Crypto available can still verify and upgrade it.
      await setAccessPin(uid, pin);
    }
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
