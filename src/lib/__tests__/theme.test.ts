import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEMES, THEME_COLORS, readTheme, setTheme } from '../theme';
import { getStorageFailure } from '../storage-failure';
import { memoryStorage } from './helpers';

describe('theme setting', () => {
  it('reads a stored theme, falling back to dark', () => {
    expect(readTheme('light')).toBe('light');
    expect(readTheme('contrast')).toBe('contrast');
    expect(readTheme('pastel')).toBe('pastel');
    expect(readTheme('dark')).toBe('dark');
    expect(readTheme(null)).toBe('dark');
    expect(readTheme('purple')).toBe('dark');
  });
  it('offers each theme with a status bar color', () => {
    expect(THEMES.map(t => t.value)).toEqual(['dark', 'light', 'contrast', 'pastel']);
    for (const t of THEMES) expect(THEME_COLORS[t.value]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('setTheme', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { documentElement: { classList: { toggle: () => {} } }, querySelectorAll: () => [] });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves the theme and returns true', () => {
    expect(setTheme('light')).toBe(true);
    expect(storage.getItem('ascended_theme')).toBe('light');
    expect(getStorageFailure('theme')).toBe(null);
  });

  it('still applies the theme but returns false and records the failure when storage is full', () => {
    storage.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); };
    expect(setTheme('pastel')).toBe(false);
    expect(getStorageFailure('theme')).toMatchObject({ quota: true });
  });
});
