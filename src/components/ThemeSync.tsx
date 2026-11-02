'use client';

import { useEffect } from 'react';
import { THEME_KEY, applyTheme, getTheme } from '@/lib/theme';

/**
 * Keeps the status bar color (theme-color, added by Next.js after the first paint) in step with the theme, and
 * follows a theme changed in another tab. The theme's classes are set before the first paint (display-scale.ts).
 */
export default function ThemeSync() {
  useEffect(() => {
    applyTheme(getTheme());
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) applyTheme(getTheme()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return null;
}
