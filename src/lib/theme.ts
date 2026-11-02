// The app's color theme, chosen in Settings → Interface and saved on this device:
// - dark (default): navy and gold.
// - light: white and gold, for bright rooms (the same colors as the printed report).
// - contrast: high contrast, black with white text and bright yellow, for low vision.
// Applied as classes on <html> ("dark", plus "theme-contrast") before the first paint by the display-size script
// (display-scale.ts); the colors are the CSS variables in globals.css.

export type Theme = 'dark' | 'light' | 'contrast';
export const THEME_KEY = 'ascended_theme';
export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Navy and gold (the default).' },
  { value: 'light', label: 'Light', description: 'White and gold, easier to read in a bright room.' },
  { value: 'contrast', label: 'High Contrast', description: 'Black, white and bright yellow, with stronger outlines.' },
];

/** The status bar color (the browser's theme-color) for each theme. */
export const THEME_COLORS: Record<Theme, string> = { dark: '#0a111f', light: '#f9fafb', contrast: '#000000' };

export function readTheme(stored: string | null): Theme {
  return stored === 'light' || stored === 'contrast' ? stored : 'dark';
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
  root.classList.toggle('dark', theme !== 'light');
  root.classList.toggle('theme-contrast', theme === 'contrast');
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', THEME_COLORS[theme]));
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not saved; still applied for this visit.
  }
  applyTheme(theme);
}
