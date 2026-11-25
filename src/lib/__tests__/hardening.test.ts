import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import { readSidebarEnabled } from '../ui-preferences';
import { generateUUID, localDayKey } from '../helpers';
import { decryptBackupText, MAX_BACKUP_FILE_BYTES } from '../backup';

// Stored values the app reads back and trusts (passcode settings, the PIN, a setting, a backup file), checked so a
// damaged or tampered value fails clearly instead of hanging, crashing or locking the user out of the app.
// Runs under TZ=America/Los_Angeles (vitest.config.mts).

const CONFIG_KEY = 'ascended_passcode_v1';

describe('passcode settings with an impossible iteration count (audit M3)', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: typeof import('../secure-store');
  beforeEach(async () => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', globalThis);
    vi.resetModules();
    store = await import('../secure-store');
  });

  const tamper = (iterations: unknown) => {
    const config = JSON.parse(storage.getItem(CONFIG_KEY)!);
    storage.setItem(CONFIG_KEY, JSON.stringify({ ...config, iterations }));
  };

  it('fails at once with a clear message instead of running the count', async () => {
    await store.enablePasscode('passcode1');
    for (const iterations of [1e12, 2 ** 40, 0, -5, 1.5, 'lots', null]) {
      tamper(iterations);
      vi.resetModules();
      store = await import('../secure-store');
      const started = Date.now();
      await expect(store.unlock('passcode1')).rejects.toBeInstanceOf(store.DamagedPasscodeSettingsError);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  }, 30000);

  it('still unlocks with the count the app writes', async () => {
    await store.enablePasscode('passcode1');
    vi.resetModules();
    store = await import('../secure-store');
    expect(await store.unlock('passcode1')).toBe(true);
    expect(store.MAX_KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  }, 30000);
});

describe('a stored PIN with an impossible iteration count or length (audit L1)', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let pin: typeof import('../access-pin');
  beforeEach(async () => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
    pin = await import('../access-pin');
  });
  const KEY = 'ascended_access_pin_v1_u';

  it('is rejected at once, not derived', async () => {
    expect(await pin.setAccessPin('u', '1234')).toBe(true);
    const [scheme, version, , salt, hash] = storage.getItem(KEY)!.split(':');
    for (const stored of [
      `${scheme}:${version}:1000000000000:${salt}:${hash}`,
      `${scheme}:${version}:100000:${salt}:${btoa('x'.repeat(100000))}`,
      `${scheme}:${version}:100000:${salt}:${btoa('xy')}`,
    ]) {
      storage.setItem(KEY, stored);
      const started = Date.now();
      expect(await pin.checkAccessPin('u', '1234')).toBe(false);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it('still accepts the PIN as the app stores it', async () => {
    expect(await pin.setAccessPin('u', '1234')).toBe(true);
    expect(await pin.checkAccessPin('u', '1234')).toBe(true);
    expect(await pin.checkAccessPin('u', '9999')).toBe(false);
  });
});

describe('the student sidebar setting (audit M11)', () => {
  it('reads true or false, and anything else as on, without throwing', () => {
    expect(readSidebarEnabled(null)).toBe(true);
    expect(readSidebarEnabled('true')).toBe(true);
    expect(readSidebarEnabled('false')).toBe(false);
    expect(readSidebarEnabled('{not json')).toBe(true);
    expect(readSidebarEnabled('"no"')).toBe(true);
    expect(readSidebarEnabled('0')).toBe(true);
  });
});

describe('a protected backup file that is not a backup (audit L2, M8)', () => {
  it('gets the damaged-file message, not a raw syntax error', async () => {
    await expect(decryptBackupText('this is not json', 'password1')).rejects.toThrow('Wrong password, or the file is damaged.');
  });
  it('is refused by size before it is parsed or decrypted', async () => {
    await expect(decryptBackupText('x'.repeat(MAX_BACKUP_FILE_BYTES + 1), 'password1')).rejects.toThrow(/too large/);
  });
});

describe('ids and dates', () => {
  it('generateUUID gives version-4 ids, from the secure generator when there is one (audit L16)', () => {
    const ids = new Set(Array.from({ length: 500 }, generateUUID));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('generateUUID still works without crypto.randomUUID (an http page)', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => original.getRandomValues(a) });
    try {
      expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
  it('localDayKey is the local day, not the UTC one (a US evening is not tomorrow) (audit L25)', () => {
    const evening = new Date(2026, 10, 18, 21, 30); // 9:30 pm in Los Angeles is the 19th in UTC
    expect(evening.toISOString().slice(0, 10)).toBe('2026-11-19');
    expect(localDayKey(evening)).toBe('2026-11-18');
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('damaged passcode settings shape and base64, and locked removeItem', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: typeof import('../secure-store');
  beforeEach(async () => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', globalThis);
    vi.resetModules();
    store = await import('../secure-store');
  });

  it('throws DamagedPasscodeSettingsError when fields are missing or base64 is corrupt', async () => {
    for (const badConfig of [
      { v: 1, iterations: 600_000, check: 'AAAA' }, // missing salt
      { v: 2, salt: 'AAAA', iterations: 600_000, check: 'AAAA' }, // missing wrappedDek
      { v: 99, salt: 'AAAA', iterations: 600_000, check: 'AAAA' }, // bad version
      { v: 1, salt: '!!!not-base64!!!', iterations: 600_000, check: 'AAAA' }, // corrupt base64
    ]) {
      storage.setItem(CONFIG_KEY, JSON.stringify(badConfig));
      vi.resetModules();
      store = await import('../secure-store');
      await expect(store.unlock('passcode1')).rejects.toBeInstanceOf(store.DamagedPasscodeSettingsError);
    }
  });

  it('blocks removeItem on sensitive keys while locked', async () => {
    await store.enablePasscode('passcode1');
    vi.resetModules();
    const locked = await import('../secure-store');
    expect(locked.isUnlocked()).toBe(false);
    expect(() => locked.removeItem('ascended_students_v2_u')).toThrow('Locked');
  }, 20000);
});

describe('setAccessPin format validation and schema numeric/GAS target validation', () => {
  it('rejects PINs that are not 4 to 8 digits in setAccessPin', async () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
    const pin = await import('../access-pin');
    expect(await pin.setAccessPin('u', '123')).toBe(false);
    expect(await pin.setAccessPin('u', '123456789')).toBe(false);
    expect(await pin.setAccessPin('u', '12a4')).toBe(false);
    expect(pin.hasAccessPin('u')).toBe(false);
  });

  it('allows negative GAS targets (-2..-1) in GoalTemplateSchema and AssignedGoalEditSchema while blocking negative non-GAS targets', async () => {
    const { GoalTemplateSchema, AssignedGoalEditSchema } = await import('../schemas');
    expect(GoalTemplateSchema.safeParse({
      name: 'GAS Goal',
      type: 'GOAL_ATTAINMENT_SCALE',
      smartGoalPrompt: 'By [date], STUDENT will reach expected level.',
      sessionTargetValue: -1,
    }).success).toBe(true);
    expect(AssignedGoalEditSchema.safeParse({
      name: 'GAS Goal',
      dataCaptureType: 'GOAL_ATTAINMENT_SCALE',
      smartGoal: 'By [date], STUDENT will reach expected level.',
      sessionTargetValue: -2,
    }).success).toBe(true);
    expect(GoalTemplateSchema.safeParse({
      name: 'GAS Goal',
      type: 'GOAL_ATTAINMENT_SCALE',
      smartGoalPrompt: 'By [date], STUDENT will reach expected level.',
      sessionTargetValue: -3,
    }).success).toBe(false);
    expect(GoalTemplateSchema.safeParse({
      name: 'Artic Goal',
      type: 'ARTICULATION',
      smartGoalPrompt: 'By [date], STUDENT will produce /s/ with 80% accuracy.',
      sessionTargetValue: -5,
    }).success).toBe(false);
    const parsed = AssignedGoalEditSchema.parse({
      name: 'Artic Goal',
      dataCaptureType: 'ARTICULATION',
      smartGoal: 'By [date], STUDENT will produce /s/.',
      sessionTargetValue: '   ',
      baseline: '   ',
    });
    expect(parsed.sessionTargetValue).toBeUndefined();
    expect(parsed.baseline).toBeUndefined();
  });
});

