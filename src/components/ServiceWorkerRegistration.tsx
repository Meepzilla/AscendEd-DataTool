'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that stores the app for offline use. Only the static build
 * (`npm run build:static`) generates sw.js, and the Android app loads its files from the
 * device already, so it is skipped there.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== 'true') return;
    if ((window as any).Capacitor?.isNativePlatform?.()) return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
    // Ask the browser not to clear stored data (students, sessions) when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return null;
}
