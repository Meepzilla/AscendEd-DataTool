// Passcode protection: student data (students, sessions and unsaved Data Entry work) is stored encrypted on the
// device, readable only after the passcode is entered.
//
// - The passcode is never stored. A key is derived from it (PBKDF2-SHA-256, 600,000 rounds, random salt) and
//   used for AES-256-GCM. Only the salt and a small encrypted check value are kept, to tell a right passcode
//   from a wrong one.
// - After unlocking, the decrypted data is held in memory for the app (which reads and writes storage
//   synchronously); each write is encrypted and stored in the background, in order. Locking reloads the page,
//   which clears the memory and the key.
// - Without protection, everything works as before (plain localStorage).
//
// A forgotten passcode can't be recovered: the data can only be erased and restored from a backup.

const CONFIG_KEY = 'ascended_passcode_v1';
const ITERATIONS = 600_000;
const PREFIX = 'enc1:';
const CHECK_TEXT = 'ascended-passcode-check';
const SPACE_CHECK_KEY = '__ascended_space_check';
export const MIN_PASSCODE_LENGTH = 6;

/** Keys holding student data. Templates and display settings aren't student data and stay as they are. */
const SENSITIVE = /^ascended_(students_v2|sessions_v2|data_entry_draft_v1)_/;
export const isSensitiveKey = (key: string) => SENSITIVE.test(key);

interface PasscodeConfig { v: 1; salt: string; iterations: number; check: string; autoLockMinutes?: number }

let key: CryptoKey | null = null;
const cache = new Map<string, string | null>();
const writing = new Map<string, Promise<void>>();
const dirty = new Set<string>();
let onWriteError: ((error: unknown) => void) | null = null;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const b64Chunked = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));

function readConfig(): PasscodeConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPasscodeEnabled(): boolean {
  return typeof window !== 'undefined' && !!readConfig();
}
export function isUnlocked(): boolean {
  return !isPasscodeEnabled() || key !== null;
}
export function getAutoLockMinutes(): number {
  return readConfig()?.autoLockMinutes ?? 15;
}
export function setAutoLockMinutes(minutes: number) {
  const config = readConfig();
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...config, autoLockMinutes: minutes }));
}
/** Called when a background write fails (e.g. storage full), so the app can say so. */
export function setWriteErrorHandler(handler: ((error: unknown) => void) | null) {
  onWriteError = handler;
}

async function deriveKey(passcode: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptWith(k: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)));
  const all = new Uint8Array(iv.length + data.length);
  all.set(iv);
  all.set(data, iv.length);
  return PREFIX + b64Chunked(all);
}

async function decryptWith(k: CryptoKey, stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) throw new Error('Not encrypted');
  const all = unb64(stored.slice(PREFIX.length));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, k, all.subarray(12));
  return new TextDecoder().decode(plain);
}

/** The stored length of a value once encrypted (prefix + base64 of IV, ciphertext and tag). */
const encryptedLength = (text: string) => PREFIX.length + Math.ceil((12 + new TextEncoder().encode(text).length + 16) / 3) * 4;

/** Whether replacing `key`'s stored value with one `newLength` long fits in storage (checked synchronously). */
function fits(storageKey: string, newLength: number): boolean {
  const extra = newLength - (localStorage.getItem(storageKey)?.length ?? 0);
  if (extra <= 0) return true;
  try {
    localStorage.setItem(SPACE_CHECK_KEY, 'x'.repeat(extra));
    localStorage.removeItem(SPACE_CHECK_KEY);
    return true;
  } catch {
    try { localStorage.removeItem(SPACE_CHECK_KEY); } catch { /* nothing stored */ }
    return false;
  }
}

function persist(storageKey: string) {
  if (writing.has(storageKey)) { dirty.add(storageKey); return; }
  const run = (async () => {
    try {
      const value = cache.get(storageKey);
      if (value === null || value === undefined) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, await encryptWith(key!, value));
    } catch (error) {
      onWriteError?.(error);
    }
  })().finally(() => {
    writing.delete(storageKey);
    if (dirty.delete(storageKey)) persist(storageKey);
  });
  writing.set(storageKey, run);
}

// ---- Storage access used by the app (same shape as localStorage) ----

/** Reads a stored value. Student data comes from memory (decrypted at unlock) when protection is on. */
export function getItem(storageKey: string): string | null {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) return null;
    return cache.get(storageKey) ?? null;
  }
  return localStorage.getItem(storageKey);
}

/**
 * Stores a value. With protection on, student data is kept in memory and encrypted into storage in the
 * background; whether it fits is checked first, so a full storage throws here as localStorage would.
 */
export function setItem(storageKey: string, value: string) {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    if (!key) throw new Error('Locked');
    if (!fits(storageKey, encryptedLength(value))) throw new DOMException('Storage is full', 'QuotaExceededError');
    cache.set(storageKey, value);
    persist(storageKey);
    return;
  }
  localStorage.setItem(storageKey, value);
}

export function removeItem(storageKey: string) {
  if (isSensitiveKey(storageKey) && isPasscodeEnabled()) {
    cache.set(storageKey, null);
    persist(storageKey);
    return;
  }
  localStorage.removeItem(storageKey);
}

/** Whether a stored student-data value couldn't be decrypted at unlock (damaged); it is left as stored. */
const undecryptable = new Set<string>();
export function isUndecryptable(storageKey: string) {
  return undecryptable.has(storageKey);
}

/** Waits until every background write has been stored. */
export async function flushWrites() {
  while (writing.size) await Promise.all([...writing.values()]);
}

const sensitiveKeysInStorage = () => {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSensitiveKey(k)) keys.push(k);
  }
  return keys;
};

// ---- Passcode ----

/** Unlocks with the passcode: true if it is right (the data is then decrypted into memory). */
export async function unlock(passcode: string): Promise<boolean> {
  const config = readConfig();
  if (!config) return true;
  const candidate = await deriveKey(passcode, unb64(config.salt), config.iterations);
  try {
    if (await decryptWith(candidate, config.check) !== CHECK_TEXT) return false;
  } catch {
    return false;
  }
  cache.clear();
  undecryptable.clear();
  for (const storageKey of sensitiveKeysInStorage()) {
    const stored = localStorage.getItem(storageKey)!;
    try {
      cache.set(storageKey, await decryptWith(candidate, stored));
    } catch {
      // Left as stored; the app reports it as unreadable and doesn't write over it.
      undecryptable.add(storageKey);
      cache.set(storageKey, '\u0000damaged');
    }
  }
  key = candidate;
  return true;
}

async function newConfig(passcode: string, autoLockMinutes = 15): Promise<{ config: PasscodeConfig; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(passcode, salt, ITERATIONS);
  return { key: k, config: { v: 1, salt: b64(salt), iterations: ITERATIONS, check: await encryptWith(k, CHECK_TEXT), autoLockMinutes } };
}

/**
 * Writes every stored student-data value as `encode` gives it, all or nothing: if storage fills part way,
 * what was written is put back as it was.
 */
async function rewriteAll(entries: [string, string][], configValue: string | null) {
  const previous = new Map<string, string | null>();
  try {
    for (const [storageKey, value] of entries) {
      previous.set(storageKey, localStorage.getItem(storageKey));
      localStorage.setItem(storageKey, value);
    }
    previous.set(CONFIG_KEY, localStorage.getItem(CONFIG_KEY));
    if (configValue === null) localStorage.removeItem(CONFIG_KEY);
    else localStorage.setItem(CONFIG_KEY, configValue);
  } catch (error) {
    previous.forEach((value, storageKey) => {
      try {
        if (value === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, value);
      } catch { /* it fit before */ }
    });
    throw error;
  }
}

/** Turns protection on: encrypts the student data with a new passcode. */
export async function enablePasscode(passcode: string, autoLockMinutes = 15) {
  if (passcode.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  if (isPasscodeEnabled()) throw new Error('Passcode protection is already on.');
  const { config, key: k } = await newConfig(passcode, autoLockMinutes);
  const plain = sensitiveKeysInStorage().map(storageKey => [storageKey, localStorage.getItem(storageKey)!] as [string, string]);
  const encrypted: [string, string][] = [];
  for (const [storageKey, value] of plain) encrypted.push([storageKey, await encryptWith(k, value)]);
  await rewriteAll(encrypted, JSON.stringify(config));
  key = k;
  cache.clear();
  plain.forEach(([storageKey, value]) => cache.set(storageKey, value));
}

/** Changes the passcode (the data is re-encrypted). Needs the current passcode. */
export async function changePasscode(current: string, next: string) {
  if (next.length < MIN_PASSCODE_LENGTH) throw new Error(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
  await flushWrites();
  if (!(await unlock(current))) throw new Error('The current passcode is wrong.');
  if (undecryptable.size) throw new Error("Some saved data can't be read, so the passcode can't be changed. Restore a backup first.");
  const { config, key: k } = await newConfig(next, getAutoLockMinutes());
  const encrypted: [string, string][] = [];
  for (const [storageKey, value] of cache) if (value !== null) encrypted.push([storageKey, await encryptWith(k, value)]);
  await rewriteAll(encrypted, JSON.stringify(config));
  key = k;
}

/** Turns protection off: the student data is stored unencrypted again. Needs the passcode. */
export async function disablePasscode(current: string) {
  await flushWrites();
  if (!(await unlock(current))) throw new Error('The passcode is wrong.');
  if (undecryptable.size) throw new Error("Some saved data can't be read, so protection can't be turned off. Restore a backup first.");
  const plain: [string, string][] = [];
  for (const [storageKey, value] of cache) if (value !== null) plain.push([storageKey, value]);
  await rewriteAll(plain, null);
  key = null;
  cache.clear();
}

/** Forgotten passcode: erases the student data on this device and turns protection off. */
export function eraseProtectedData() {
  sensitiveKeysInStorage().forEach(storageKey => localStorage.removeItem(storageKey));
  localStorage.removeItem(CONFIG_KEY);
  key = null;
  cache.clear();
}

/** Locks the app: waits for pending writes, then reloads, which clears the data and key from memory. */
export async function lockNow() {
  await flushWrites();
  window.location.reload();
}

// ---- Password-protected files (backups) ----

export interface PasswordProtected { v: 1; salt: string; iterations: number; data: string }

/** Encrypts text with a password (same scheme as the passcode: PBKDF2-SHA-256 key, AES-256-GCM). */
export async function encryptWithPassword(text: string, password: string): Promise<PasswordProtected> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(password, salt, ITERATIONS);
  return { v: 1, salt: b64(salt), iterations: ITERATIONS, data: await encryptWith(k, text) };
}

/** Decrypts text encrypted with encryptWithPassword; throws if the password is wrong or the data damaged. */
export async function decryptWithPassword(payload: PasswordProtected, password: string): Promise<string> {
  const k = await deriveKey(password, unb64(payload.salt), payload.iterations);
  return decryptWith(k, payload.data);
}
