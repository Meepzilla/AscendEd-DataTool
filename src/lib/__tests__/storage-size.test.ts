import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkSaveFits, estimateStorage, formatBytes, serializedBytes, storageLevel,
  DATA_WARN_BYTES,
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
    const estimate = await estimateStorage(() => 1.5 * 1024 * 1024);
    expect(estimate.source).toBe('estimate');
    expect(estimate.bytes).toBe(8 * 1024 * 1024);
    expect(estimate.dataBytes).toBe(1.5 * 1024 * 1024);
    expect(estimate.quota).toBe(10 * 1024 * 1024);
    expect(estimate.percent).toBe(80);
    expect(estimate.level).toBe('warn');
    // 8 MB in the browser's total, but only 1.5 MB of it is data (the rest is the offline app): no data warning.
    expect(estimate.overDataWarn).toBe(false);
  });

  it('warns about large data on the data alone, not the total with the offline app cache', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 40 * 1024 * 1024, quota: 1000 * 1024 * 1024 }) } });
    expect((await estimateStorage(() => 3 * 1024 * 1024)).overDataWarn).toBe(false);
    expect((await estimateStorage(() => 26 * 1024 * 1024)).overDataWarn).toBe(true);
    expect(DATA_WARN_BYTES).toBe(25 * 1024 * 1024);
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
    // With no browser estimate the count is the data alone: 4 MB is well under the warning.
    expect(estimate.overDataWarn).toBe(false);
    expect((await estimateStorage(() => 30 * 1024 * 1024)).overDataWarn).toBe(true);
  });

  it('a throwing fallback count cannot break the estimate (finding B2)', async () => {
    const throwing = () => {
      throw new Error('count failed');
    };
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 2048, quota: 4096 }) } });
    const withEstimate = await estimateStorage(throwing);
    expect(withEstimate.source).toBe('estimate');
    expect(withEstimate.bytes).toBe(2048);
    expect(withEstimate.dataBytes).toBeUndefined();

    vi.stubGlobal('navigator', {});
    const withoutEstimate = await estimateStorage(throwing);
    expect(withoutEstimate.source).toBe('fallback');
    expect(withoutEstimate.bytes).toBe(0);
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

  it('flags the large-data warning on the projected data, not the browser total', async () => {
    // The browser total (with the offline app) is far past 25 MB; the data is what counts.
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 60 * 1024 * 1024, quota: 1000 * 1024 * 1024 }) } });
    const below = await checkSaveFits(512 * 1024, 0, { isIndexedDbBacked: true, dataBytes: () => 20 * 1024 * 1024 });
    expect(below.overDataWarn).toBe(false);
    expect(below.projectedDataBytes).toBe(20.5 * 1024 * 1024);
    const above = await checkSaveFits(6 * 1024 * 1024, 0, { isIndexedDbBacked: true, dataBytes: () => 20 * 1024 * 1024 });
    expect(above.overDataWarn).toBe(true);
    expect(above.fits).toBe(true);
    // Without a data count there is no data warning (the total alone can't tell data from the app cache).
    expect((await checkSaveFits(6 * 1024 * 1024, 0)).overDataWarn).toBe(false);
  });

  it('does not apply the localStorage cap to IndexedDB-backed saves without a quota', async () => {
    vi.stubGlobal('navigator', {});
    const check = await checkSaveFits(6 * 1024 * 1024, 0, { isIndexedDbBacked: true, fallbackBytes: () => 0 });
    expect(check.fits).toBe(true);
    expect(check.overDataWarn).toBe(false);
    const localCheck = await checkSaveFits(6 * 1024 * 1024, 0, { isIndexedDbBacked: false, fallbackBytes: () => 0 });
    expect(localCheck.fits).toBe(false);
  });

  it('does not run the localStorage fallback scan when browser estimate succeeds', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 1024, quota: 10 * 1024 * 1024 }) } });
    const fallbackBytes = vi.fn(() => 512);
    const check = await checkSaveFits(2048, 512, { isIndexedDbBacked: false, fallbackBytes });
    expect(check.fits).toBe(true);
    expect(fallbackBytes).not.toHaveBeenCalled();
  });
});
