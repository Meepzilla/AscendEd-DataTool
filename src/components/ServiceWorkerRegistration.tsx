'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { flushWrites, isPasscodeEnabled, isUnlocked } from '@/lib/secure-store';
import { activateWaitingUpdate, shouldApplyUpdateNow, watchForWaitingUpdate } from '@/lib/service-worker-update';

// When the app last reloaded itself to apply an update, so a worker that won't activate can't cause a reload loop.
const LAST_AUTO_UPDATE_KEY = 'ascended_last_auto_update';
const AUTO_UPDATE_GAP_MS = 60_000;

/**
 * Registers the service worker that stores the app for offline use. Only the static build
 * (`npm run build:static`) generates sw.js, and the Android app loads its files from the
 * device already, so it is skipped there.
 *
 * This sits outside the passcode lock (see app/layout.tsx) so updates are checked for and applied
 * while the lock screen is showing too.
 *
 * A new deploy downloads in the background and never takes over in the middle of a session (that
 * would force a reload and re-lock on the next tab switch). It is put in use straight away when
 * doing so costs nothing: while the lock screen is showing, or, without a passcode, when the app
 * comes back to the foreground. Otherwise an "App updated" notice offers to reload; it stays until
 * dismissed and comes back each time the app returns to the foreground.
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

    const recentlyAutoUpdated = () => {
      try {
        const last = Number(sessionStorage.getItem(LAST_AUTO_UPDATE_KEY));
        return Number.isFinite(last) && Date.now() - last < AUTO_UPDATE_GAP_MS;
      } catch {
        return false;
      }
    };

    const showNotice = (reg: ServiceWorkerRegistration) => {
      toast({
        title: 'App updated',
        description: isPasscodeEnabled()
          ? "A new version of AscendEd is ready. Reload to start using it (you'll need to unlock again); unsaved Data Entry work is kept."
          : 'A new version of AscendEd is ready. Reload to start using it; unsaved Data Entry work is kept.',
        duration: Infinity,
        action: <ToastAction altText="Reload the app" onClick={() => { void applyUpdate(reg); }}>Reload</ToastAction>,
      });
    };

    // Applies a waiting update if that is free right now; otherwise shows the notice.
    const handleWaiting = (reg: ServiceWorkerRegistration, returningToForeground: boolean) => {
      if (!reg.waiting || reloading) return;
      const applyNow = shouldApplyUpdateNow({
        visible: document.visibilityState === 'visible',
        passcodeOn: isPasscodeEnabled(),
        unlocked: isUnlocked(),
        returningToForeground,
        recentlyAutoUpdated: recentlyAutoUpdated(),
      });
      if (applyNow) {
        try { sessionStorage.setItem(LAST_AUTO_UPDATE_KEY, String(Date.now())); } catch { /* storage unavailable */ }
        void applyUpdate(reg);
      } else {
        showNotice(reg);
      }
    };

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        stopWatching = watchForWaitingUpdate(navigator.serviceWorker, reg, () => handleWaiting(reg, false));
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    // Ask the browser not to clear stored data (students, sessions) when space runs low.
    navigator.storage?.persist?.().catch(() => {});

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !registration) return;
      handleWaiting(registration, true);
      registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      stopWatching?.();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [toast]);

  return null;
}
