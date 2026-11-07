// The app's color theme, chosen in Settings → Interface and saved on this device:
// - dark (default): navy and gold.
// - light: white and gold, for bright rooms (the same colors as the printed report).
// - contrast: high contrast, black with white text and bright yellow, for low vision.
// - pastel: soft lavender, baby blue and mint, with a muted plum for buttons and links (built on light).
// Applied as classes on <html> ("dark", plus "theme-contrast"; or "theme-pastel") before the first paint by the display-size script
// (display-scale.ts); the colors are the CSS variables in globals.css.

import { clearStorageFailure, reportStorageFailure } from './storage-failure';

export type Theme = 'dark' | 'light' | 'contrast' | 'pastel';
export const THEME_KEY = 'ascended_theme';
export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Navy and gold (the default).' },
  { value: 'light', label: 'Light', description: 'White and gold, easier to read in a bright room.' },
  { value: 'contrast', label: 'High Contrast', description: 'Black, white and bright yellow, with stronger outlines.' },
  { value: 'pastel', label: 'Pastel', description: 'Soft lavender, baby blue and mint, with plum for buttons.' },
];

/** The status bar color (the browser's theme-color) for each theme. */
export const THEME_COLORS: Record<Theme, string> = { dark: '#0a111f', light: '#f9fafb', contrast: '#000000', pastel: '#f6f3fc' };

export function readTheme(stored: string | null): Theme {
  return stored === 'light' || stored === 'contrast' || stored === 'pastel' ? stored : 'dark';
}

export function getTheme(): Theme {
  try {
    return readTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return 'dark';
  }
}

/** Sets the classes and status bar color for a theme (the early script in display-scale.ts sets the classes). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme !== 'light' && theme !== 'pastel');
  root.classList.toggle('theme-contrast', theme === 'contrast');
  root.classList.toggle('theme-pastel', theme === 'pastel');
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', THEME_COLORS[theme]));
}

/** Saves the theme; false when storage is full or unavailable (it is still applied for this visit, and the failure is recorded as a persistent warning). */
export function setTheme(theme: Theme): boolean {
  try {
    localStorage.setItem(THEME_KEY, theme);
    clearStorageFailure('theme');
  } catch (error) {
    reportStorageFailure('theme', error);
    applyTheme(theme);
    return false;
  }
  applyTheme(theme);
  return true;
}
