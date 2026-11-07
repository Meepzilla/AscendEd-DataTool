import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// Access PIN scheme, with an in-memory localStorage. Each test loads a fresh copy of the module.

const UID = 'u';
const KEY = 'ascended_access_pin_v1_u';
const PIN = '1234';

const legacySha256 = (uid: string, pin: string) =>
  createHash('sha256').update(`ascended-access-lock:${uid}:${pin}`).digest('hex');
const legacyDjb2 = (uid: string, pin: string) => {
  const text = `ascended-access-lock:${uid}:${pin}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `djb2:${hash.toString(16)}`;
};

let storage: ReturnType<typeof memoryStorage>;
let pin: typeof import('../access-pin');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  pin = await import('../access-pin');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('access PIN', () => {
  it('round-trips: the right PIN unlocks and a wrong PIN does not', async () => {
    expect(await pin.setAccessPin(UID, PIN)).toBe(true);
    expect(pin.hasAccessPin(UID)).toBe(true);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
    expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
  }, 20000);

  it('stores a self-describing PBKDF2 value with a random salt, never a bare hash', async () => {
    await pin.setAccessPin(UID, PIN);
    const stored = storage.getItem(KEY)!;
    const parts = stored.split(':');
    expect(parts[0]).toBe('pbkdf2');
    expect(parts[1]).toBe('v1');
    expect(Number(parts[2])).toBeGreaterThanOrEqual(100_000);
    expect(Buffer.from(parts[3], 'base64').length).toBe(16);
    expect(Buffer.from(parts[4], 'base64').length).toBe(32);
    expect(stored).not.toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toMatch(/^djb2:/);

    await pin.setAccessPin(UID, PIN);
    expect(storage.getItem(KEY)).not.toBe(stored);
  }, 20000);

  it('upgrades a legacy SHA-256 hash to the new scheme on a successful unlock', async () => {
    storage.setItem(KEY, legacySha256(UID, PIN));
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
    expect(storage.getItem(KEY)!.startsWith('pbkdf2:v1:')).toBe(true);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
  }, 20000);

  it('does not upgrade a legacy SHA-256 hash on a wrong PIN', async () => {
    const legacy = legacySha256(UID, PIN);
    storage.setItem(KEY, legacy);
    expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(storage.getItem(KEY)).toBe(legacy);
  }, 20000);

  it('upgrades a legacy djb2 hash to the new scheme on a successful unlock', async () => {
    storage.setItem(KEY, legacyDjb2(UID, PIN));
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
    expect(storage.getItem(KEY)!.startsWith('pbkdf2:v1:')).toBe(true);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
  }, 20000);

  it('does not upgrade a legacy djb2 hash on a wrong PIN', async () => {
    const legacy = legacyDjb2(UID, PIN);
    storage.setItem(KEY, legacy);
    expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(storage.getItem(KEY)).toBe(legacy);
  }, 20000);

  it('never creates a new djb2 hash: without Web Crypto, setting a PIN fails and stores nothing', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await pin.setAccessPin(UID, PIN)).toBe(false);
      expect(storage.getItem(KEY)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal('localStorage', storage);
    }
  });

  it('without Web Crypto, a legacy djb2 value still verifies but the upgrade is deferred', async () => {
    const legacy = legacyDjb2(UID, PIN);
    storage.setItem(KEY, legacy);
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
      expect(storage.getItem(KEY)).toBe(legacy);
      expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal('localStorage', storage);
    }
  });

  it('without Web Crypto, a legacy SHA-256 value cannot be verified (it needs crypto.subtle)', async () => {
    storage.setItem(KEY, legacySha256(UID, PIN));
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await pin.checkAccessPin(UID, PIN)).toBe(false);
      expect(storage.getItem(KEY)).toBe(legacySha256(UID, PIN));
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal('localStorage', storage);
    }
  });

  it('locks out after 5 wrong PINs and lets the right PIN in once the minute has passed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T12:00:00.000Z'));
    await pin.setAccessPin(UID, PIN);
    for (let i = 0; i < 5; i++) expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(false);
    vi.setSystemTime(new Date('2026-11-06T12:01:01.000Z'));
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
  }, 30000);

  it('a successful unlock clears the failure count', async () => {
    await pin.setAccessPin(UID, PIN);
    for (let i = 0; i < 4; i++) expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
    for (let i = 0; i < 4; i++) expect(await pin.checkAccessPin(UID, '9999')).toBe(false);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(true);
  }, 30000);

  it('clearAccessPin removes the PIN', async () => {
    await pin.setAccessPin(UID, PIN);
    expect(pin.hasAccessPin(UID)).toBe(true);
    pin.clearAccessPin(UID);
    expect(pin.hasAccessPin(UID)).toBe(false);
    expect(await pin.checkAccessPin(UID, PIN)).toBe(false);
  }, 20000);
});
