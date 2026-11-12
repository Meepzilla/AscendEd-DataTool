import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkSaveFits, estimateStorage, formatBytes, serializedBytes, storageLevel,
  STORAGE_WARN_BYTES,
} from '../storage-size';

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatBytes(42)).toBe('42 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
});

describe('storageLevel', () => {
  it('warns at 70% of quota and goes critical at 90%', () => {
    expect(storageLevel(69, 100)).toBe('ok');
    expect(storageLevel(70, 100)).toBe('warn');
    expect(storageLevel(89, 100)).toBe('warn');
    expect(storageLevel(90, 100)).toBe('critical');
    expect(storageLevel(120, 100)).toBe('critical');
  });

  it('is ok when no quota is known', () => {
    expect(storageLevel(4 * 1024 * 1024, null)).toBe('ok');
  });
});

describe('serializedBytes', () => {
  it('measures the JSON form, not the in-memory object', () => {
    expect(serializedBytes([{ id: 's1' }])).toBe(new TextEncoder().encode('[{"id":"s1"}]').length);
  });
});

describe('estimateStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the browser estimate when one is reported', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 8 * 1024 * 1024, quota: 10 * 1024 * 1024 }) } });
    const estimate = await estimateStorage(() => 0);
    expect(estimate.source).toBe('estimate');
    expect(estimate.bytes).toBe(8 * 1024 * 1024);
    expect(estimate.quota).toBe(10 * 1024 * 1024);
    expect(estimate.percent).toBe(80);
    expect(estimate.level).toBe('warn');
    expect(estimate.over3MB).toBe(true);
  });

  it('calls estimate as a method of the storage object, as Chromium requires', async () => {
    // A bare extracted function loses its receiver and throws in Chromium;
    // the stub reproduces that so the fallback cannot hide the failure.
    const storage = {
      estimate: async function (this: unknown) {
        if (this !== storage) throw new TypeError('Illegal invocation');
        return { usage: 1024, quota: 2048 };
      },
    };
    vi.stubGlobal('navigator', { storage });
    const estimate = await estimateStorage(() => 0);
    expect(estimate.source).toBe('estimate');
    expect(estimate.quota).toBe(2048);
  });

  it('falls back to the counted bytes with no quota when the browser reports nothing', async () => {
    vi.stubGlobal('navigator', {});
    const estimate = await estimateStorage(() => 4 * 1024 * 1024);
    expect(estimate.source).toBe('fallback');
    expect(estimate.bytes).toBe(4 * 1024 * 1024);
    expect(estimate.quota).toBe(null);
    expect(estimate.percent).toBe(null);
    expect(estimate.level).toBe('ok');
    expect(estimate.over3MB).toBe(true);
  });
});

describe('checkSaveFits', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a save that would pass the quota, counting the replaced list once', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 9 * 1024 * 1024, quota: 10 * 1024 * 1024 }) } });
    // Replacing a 2 MB list with a 2.5 MB one: projected 9.5 MB fits.
    expect(await checkSaveFits(2.5 * 1024 * 1024, 2 * 1024 * 1024)).toMatchObject({ fits: true });
    // Replacing it with a 3.5 MB one: projected 10.5 MB does not fit.
    expect(await checkSaveFits(3.5 * 1024 * 1024, 2 * 1024 * 1024)).toMatchObject({ fits: false });
  });

  it('flags the 3 MB warning on the projected total', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 2 * 1024 * 1024, quota: 100 * 1024 * 1024 }) } });
    const below = await checkSaveFits(512 * 1024, 0);
    expect(below.over3MB).toBe(false);
    const above = await checkSaveFits(2 * 1024 * 1024, 0);
    expect(above.over3MB).toBe(true);
    expect(above.fits).toBe(true);
    expect(STORAGE_WARN_BYTES).toBe(3 * 1024 * 1024);
  });

  it('does not apply the localStorage cap to IndexedDB-backed saves without a quota', async () => {
    vi.stubGlobal('navigator', {});
    const check = await checkSaveFits(6 * 1024 * 1024, 0, { isIndexedDbBacked: true, fallbackBytes: () => 0 });
    expect(check.fits).toBe(true);
    expect(check.over3MB).toBe(true);
    const localCheck = await checkSaveFits(6 * 1024 * 1024, 0, { isIndexedDbBacked: false, fallbackBytes: () => 0 });
    expect(localCheck.fits).toBe(false);
  });
});
