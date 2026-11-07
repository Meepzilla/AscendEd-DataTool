import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesce } from '../coalesce';

describe('reloading once after a burst of saves from another tab', () => {
  afterEach(() => vi.useRealTimers());

  it('runs once after the last of several quick triggers, so none is missed', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const c = coalesce(run, 400);
    // Save All in the other tab: five saves about 100 ms apart.
    for (let i = 0; i < 5; i++) { c.trigger(); await vi.advanceTimersByTimeAsync(100); }
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again when a trigger arrives while it is running', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const c = coalesce(run, 400);
    c.trigger();
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(1);
    c.trigger(); // another save while the first reload is still reading
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(1); // waits for the running reload
    release();
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps working after a run fails, and stops when cancelled', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue(undefined);
    const c = coalesce(run, 400);
    c.trigger();
    await vi.advanceTimersByTimeAsync(400);
    c.trigger();
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(2);
    c.cancel();
    c.trigger();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
