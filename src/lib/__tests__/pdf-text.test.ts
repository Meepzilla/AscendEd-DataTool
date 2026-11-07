import { describe, expect, it } from 'vitest';
import { createCachedLoader, toLines } from '../pdf-text';

// pdf-text.ts: a failed pdf.js load used to stay rejected forever for the session, because the
// cached import promise was never reset. The loader behind it now retries after a failure.
describe('createCachedLoader', () => {
  it('retries after a failure and then caches the success', async () => {
    let attempts = 0;
    const load = createCachedLoader(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('pdf.js failed to load');
      return { ok: true };
    });
    await expect(load()).rejects.toThrow('pdf.js failed to load');
    await expect(load()).resolves.toEqual({ ok: true });
    await expect(load()).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    let attempts = 0;
    const load = createCachedLoader(async () => {
      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return 42;
    });
    const [a, b] = await Promise.all([load(), load()]);
    expect([a, b]).toEqual([42, 42]);
    expect(attempts).toBe(1);
  });

  it('shares one failure between concurrent callers, then retries', async () => {
    let attempts = 0;
    const load = createCachedLoader(async () => {
      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      throw new Error('nope');
    });
    await expect(Promise.all([load(), load()])).rejects.toThrow('nope');
    expect(attempts).toBe(1);
    await expect(load()).rejects.toThrow('nope');
    expect(attempts).toBe(2);
  });
});

describe('toLines', () => {
  it('groups pieces on the same baseline into one line, left to right', () => {
    const lines = toLines([
      { str: 'Name:', transform: [1, 0, 0, 1, 10, 100], width: 30 },
      { str: 'Ava', transform: [1, 0, 0, 1, 50, 100], width: 20 },
      { str: 'Goal 1', transform: [1, 0, 0, 1, 10, 80], width: 40 },
    ]);
    expect(lines).toEqual(['Name: Ava', 'Goal 1']);
  });
});
