import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// Passcode protection, with an in-memory localStorage. Each test loads a fresh copy of the module (it keeps
// the key and decrypted data in memory).
const S = 'ascended_students_v2_u';
const D = 'ascended_data_entry_draft_v1_u';
let storage: ReturnType<typeof memoryStorage>;
let store: typeof import('../secure-store');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
  vi.resetModules();
  store = await import('../secure-store');
});

const later = (ms: number, fn: () => void) => new Promise<void>(resolve => setTimeout(() => { fn(); resolve(); }, ms));

describe('passcode protection', () => {
  it('encrypts student data, unlocks with the right passcode only, and leaves other settings alone', async () => {
    storage.setItem(S, '[{"name":"Ava"}]');
    storage.setItem('ascended_display_scale', '1');
    await store.enablePasscode('passcode1');
    expect(storage.getItem(S)!.startsWith('enc1:')).toBe(true);
    expect(storage.getItem(S)).not.toContain('Ava');
    expect(storage.getItem('ascended_display_scale')).toBe('1');

    vi.resetModules();
    const fresh = await import('../secure-store');
    expect(fresh.isUnlocked()).toBe(false);
    expect(await fresh.unlock('wrong-pass')).toBe(false);
    expect(await fresh.unlock('passcode1')).toBe(true);
    expect(fresh.getItem(S)).toBe('[{"name":"Ava"}]');
  }, 20000);

  it('keeps data written while protection is being turned on', async () => {
    storage.setItem(S, 'v1');
    const enabling = store.enablePasscode('passcode1');
    await later(5, () => { storage.setItem(S, 'v2'); storage.setItem(D, 'draft'); });
    await enabling;
    expect(storage.getItem(D)!.startsWith('enc1:')).toBe(true);
    expect(store.getItem(S)).toBe('v2');
    await store.unlock('passcode1');
    expect([store.getItem(S), store.getItem(D)]).toEqual(['v2', 'draft']);
  }, 20000);

  it('keeps data saved while the passcode is changed or protection is turned off', async () => {
    storage.setItem(S, 'v1');
    await store.enablePasscode('passcode1');
    const changing = store.changePasscode('passcode1', 'passcode2');
    await later(100, () => store.setItem(S, 'v2'));
    await changing;
    await store.flushWrites();
    expect(await store.unlock('passcode2')).toBe(true);
    expect(store.getItem(S)).toBe('v2');

    const disabling = store.disablePasscode('passcode2');
    await later(100, () => store.setItem(S, 'v3'));
    await disabling;
    expect(storage.getItem(S)).toBe('v3');
    expect(store.isPasscodeEnabled()).toBe(false);
  }, 30000);

  it('puts damaged data back exactly as stored when a restore is rolled back', async () => {
    storage.setItem(S, 'v1');
    await store.enablePasscode('passcode1');
    storage.setItem(D, 'enc1:damaged-data');
    await store.unlock('passcode1');
    expect(store.isUndecryptable(D)).toBe(true);

    const snapshot = store.snapshotItem(D);
    store.setItem(D, 'new value');
    store.restoreItem(D, snapshot);
    await store.flushWrites();
    expect(storage.getItem(D)).toBe('enc1:damaged-data');
    expect(store.isUndecryptable(D)).toBe(true);

    store.setItem(D, 'fresh');
    await store.flushWrites();
    await store.unlock('passcode1');
    expect(store.getItem(D)).toBe('fresh');
  }, 20000);
});
