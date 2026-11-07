import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// safe-storage.ts: a failed write is no longer silent — it is recorded (persistent warning) and
// the registered handler is told once per failure, while the return value still says if it landed.
let storage: ReturnType<typeof memoryStorage>;
let safe: typeof import('../safe-storage');
let failures: typeof import('../storage-failure');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
  vi.resetModules();
  safe = await import('../safe-storage');
  failures = await import('../storage-failure');
});

describe('writeLocal', () => {
  it('saves and returns true when storage works', () => {
    expect(safe.writeLocal('k', 'v')).toBe(true);
    expect(storage.getItem('k')).toBe('v');
    expect(failures.getStorageFailures()).toHaveLength(0);
  });

  it('returns false, records the failure and tells the handler once when storage is full', () => {
    const handler = vi.fn();
    safe.setSafeStorageErrorHandler(handler);
    const original = storage.setItem;
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    expect(safe.writeLocal('k', 'v')).toBe(false);
    expect(safe.writeLocal('k', 'v')).toBe(false);
    expect(failures.getStorageFailure('safe-storage')).toMatchObject({ quota: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toContain('applies for this visit only');
    storage.setItem = original;
    expect(safe.writeLocal('k', 'v')).toBe(true);
    expect(failures.getStorageFailure('safe-storage')).toBe(null);
  });

  it('does not tell the handler after it is removed', () => {
    const handler = vi.fn();
    safe.setSafeStorageErrorHandler(handler);
    safe.setSafeStorageErrorHandler(null);
    storage.setItem = () => { throw new Error('no storage'); };
    expect(safe.writeLocal('k', 'v')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(failures.getStorageFailure('safe-storage')).not.toBe(null);
  });
});

describe('readLocal', () => {
  it('returns null and records the failure when storage cannot be read', () => {
    storage.getItem = () => { throw new Error('denied'); };
    expect(safe.readLocal('k')).toBe(null);
    expect(failures.getStorageFailure('safe-storage')).not.toBe(null);
  });
});
