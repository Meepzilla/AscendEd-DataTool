'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { flushWrites, isPasscodeEnabled } from '@/lib/secure-store';
import { activateWaitingUpdate, watchForWaitingUpdate } from '@/lib/service-worker-update';

/**
 * Registers the service worker that stores the app for offline use. Only the static build
 * (`npm run build:static`) generates sw.js, and the Android app loads its files from the
 * device already, so it is skipped there.
 *
 * The service worker serves the stored version of the app, so a new deploy waits in the
 * background until the app is reopened, locked, or reloaded from the notice below (rather than
 * taking over mid-session and causing a build-ID mismatch that forces a hard reload and re-lock
 * on the next tab switch). The app checks for updates whenever it comes back to the foreground.
 */
export default function ServiceWorkerRegistration() {
  const { toast } = useToast();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== 'true') return;
    if ((window as any).Capacitor?.isNativePlatform?.()) return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let reloading = false;
    let registration: ServiceWorkerRegistration | undefined;
    let stopWatching: (() => void) | undefined;

    const applyUpdate = async (reg: ServiceWorkerRegistration) => {
      if (reloading) return;
      reloading = true;
      try {
        await flushWrites();
      } catch {
        // A failed write was already reported; reloading loses nothing more than the failed write did.
      }
      if (reg.waiting) {
        await activateWaitingUpdate(navigator.serviceWorker, reg.waiting);
      }
      window.location.reload();
    };

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        stopWatching = watchForWaitingUpdate(navigator.serviceWorker, reg, () => {
          toast({
            title: 'App updated',
            description: isPasscodeEnabled()
              ? "A new version of AscendEd is ready. Reload to start using it (you'll need to unlock again); unsaved Data Entry work is kept."
              : 'A new version of AscendEd is ready. Reload to start using it; unsaved Data Entry work is kept.',
            duration: 60_000,
            action: <ToastAction altText="Reload the app" onClick={() => { void applyUpdate(reg); }}>Reload</ToastAction>,
          });
        });
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    // Ask the browser not to clear stored data (students, sessions) when space runs low.
    navigator.storage?.persist?.().catch(() => {});

    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') registration?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', checkForUpdate);

    return () => {
      cancelled = true;
      stopWatching?.();
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, [toast]);

  return null;
}
