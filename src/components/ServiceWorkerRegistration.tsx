'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Registers the service worker that stores the app for offline use. Only the static build
 * (`npm run build:static`) generates sw.js, and the Android app loads its files from the
 * device already, so it is skipped there.
 *
 * The service worker serves the stored version of the app, so a new deploy is only used once the
 * new version has been downloaded. To make that quick, the app checks for an update whenever it comes
 * back to the foreground, and offers to reload when a new version has taken over.
 */
export default function ServiceWorkerRegistration() {
  const { toast } = useToast();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== 'true') return;
    if ((window as any).Capacitor?.isNativePlatform?.()) return;
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker.register('/sw.js')
      .then(reg => { registration = reg; })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    // Ask the browser not to clear stored data (students, sessions) when space runs low.
    navigator.storage?.persist?.().catch(() => {});

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', checkForUpdate);

    // A new version took over (not the first install, when there was no previous one).
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!hadController) return;
      toast({
        title: 'App updated',
        description: 'A new version of AscendEd is ready. Reload to start using it; unsaved Data Entry work is kept.',
        duration: 60_000,
        action: <ToastAction altText="Reload the app" onClick={() => window.location.reload()}>Reload</ToastAction>,
      });
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      document.removeEventListener('visibilitychange', checkForUpdate);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [toast]);

  return null;
}
