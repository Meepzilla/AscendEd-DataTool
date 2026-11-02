import { describe, expect, it } from 'vitest';
import { THEMES, THEME_COLORS, readTheme } from '../theme';

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
