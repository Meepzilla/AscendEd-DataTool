'use client';

import { useEffect } from 'react';
import { useErrorLog } from '@/hooks/use-error-log';
import { installGlobalErrorHandlers } from '@/lib/global-error-handler';
import { THEME_KEY, applyTheme, getTheme } from '@/lib/theme';

/**
 * Mount-only root browser effects (renders nothing):
 * 1. Captures uncaught errors and unhandled rejections into the in-memory error log.
 * 2. Keeps the status-bar theme-color meta tag and cross-tab theme changes in sync.
 * 3. Detects whether Chromium reports zoomed bounding rects in screen pixels (`zoomed-rects` class on <html>).
 */
export default function AppBrowserEffects() {
  const { addErrorLog } = useErrorLog();

  // Installs the window error and unhandled-rejection handlers once per page load (see
  // lib/global-error-handler.ts). Lives inside ErrorLogProvider, so uncaught errors land in
  // the in-memory error log instead of vanishing.
  useEffect(() => installGlobalErrorHandlers(window, log => addErrorLog(log)), [addErrorLog]);

  // Keeps the status bar color (theme-color, added by Next.js after the first paint) in step with the theme, and
  // follows a theme changed in another tab. The theme's classes are set before the first paint (display-scale.ts).
  useEffect(() => {
    applyTheme(getTheme());
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) applyTheme(getTheme()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The page is shrunk with CSS zoom on <body> (globals.css). Browsers measure zoomed elements differently:
  // Chromium (Chrome, Edge, the Android app's WebView) reports positions in screen pixels, so a menu placed at
  // the measured position inside the zoomed body lands at 75% of it (far from its button); Safari reports them
  // in the body's own pixels, which works as is. This checks which kind of browser it is and, for the first
  // kind, marks <html> so globals.css places menus and popovers in screen pixels (and shrinks their contents
  // back to the app's size).
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:100px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const zoom = parseFloat(getComputedStyle(document.body).zoom || '1') || 1;
    const left = probe.getBoundingClientRect().left;
    probe.remove();
    // Positions come back zoomed (e.g. 75 for 100px at 0.75): place floating content in screen pixels.
    document.documentElement.classList.toggle('zoomed-rects', zoom !== 1 && Math.abs(left - 100 * zoom) < 1);
  }, []);

  return null;
}
