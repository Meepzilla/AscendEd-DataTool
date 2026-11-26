'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { flushWrites, isPasscodeEnabled, isUnlocked } from '@/lib/secure-store';
import { applyWaitingUpdate, reloadFromUpdateNotice, shouldApplyUpdateNow, watchForWaitingUpdate } from '@/lib/service-worker-update';

// When the app last reloaded itself to apply an update, so a worker that won't activate can't cause a reload loop.
const LAST_AUTO_UPDATE_KEY = 'ascended_last_auto_update';
const AUTO_UPDATE_GAP_MS = 60_000;
const UPDATE_TITLE = 'App updated';
const OTHER_TABS_TITLE = 'AscendEd is open in another tab';
const UPDATE_FAILED_TITLE = 'Update could not start';

/**
 * Registers the service worker that stores the app for offline use. Only the static build
 * (`npm run build:static`) generates sw.js, and the Android app loads its files from the
 * device already, so it is skipped there.
 *
 * This sits outside the passcode lock (see app/layout.tsx) so updates are checked for and applied while the lock
 * screen is showing too.
 *
 * A new deploy downloads in the background and never takes over in the middle of a session (that would force a
 * reload and re-lock on the next tab switch). It is put in use straight away when doing so costs nothing: while the
 * lock screen is showing, or, without a passcode, when the app comes back to the foreground; and only when no other
 * AscendEd tab or window is open, since the new version takes over every tab and another could be mid-session.
 * Otherwise an "App updated" notice offers to reload; it stays until dismissed and comes back each time the app
 * returns to the foreground. If another notice is showing when it would appear, it waits and is offered once that
 * notice closes, instead of replacing it. With another tab open, Reload says so and offers to update all tabs.
 */
export default function ServiceWorkerRegistration() {
  const { toast, toasts } = useToast();
  // Whether another notice is showing (the update notice is never shown over it: only one notice shows at a
  // time, so it would replace, say, a save error). Updated in an effect after every render, so it reflects the
  // toasts as committed, not as they happened to be mid-render.
  const otherToastOpen = useRef(false);
  // Set by the registration effect: called after every render with the latest toasts, so an update notice that
  // was deferred because another notice was showing can be offered once that notice closes.
  const toastsChangedRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    otherToastOpen.current = toasts.some(
      t => t.open !== false && t.title !== UPDATE_TITLE && t.title !== OTHER_TABS_TITLE && t.title !== UPDATE_FAILED_TITLE,
    );
    toastsChangedRef.current?.();
  });

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== 'true') return;
    if ((window as any).Capacitor?.isNativePlatform?.()) return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let reloading = false;
    let registration: ServiceWorkerRegistration | undefined;
    let stopWatching: (() => void) | undefined;

    // Puts the waiting version in use and reloads. `onlyIfAlone`: only when no other AscendEd tab or window is open,
    // since the new version takes over every open tab and another tab could be in the middle of a session.
    const applyUpdate = async (reg: ServiceWorkerRegistration, onlyIfAlone: boolean) => {
      if (reloading) return 'reloaded' as const;
      reloading = true;
      const result = await applyWaitingUpdate({
        container: navigator.serviceWorker,
        registration: reg,
        flush: flushWrites,
        reload: () => window.location.reload(),
        onlyIfAlone,
      });
      if (result !== 'reloaded') reloading = false;
      return result;
    };

    // Reload on the notice: this tab alone updates straight away; with another tab open, say so first and let the
    // person choose to update them all (each will reload and, with a passcode, lock). If the alone attempt fails,
    // say so and offer that same explicit choice — a failed tap never turns into updating every tab on its own.
    const reloadFromNotice = async (reg: ServiceWorkerRegistration) => {
      await reloadFromUpdateNotice({
        applyUpdate: (onlyIfAlone) => applyUpdate(reg, onlyIfAlone),
        onOtherTabsOpen: () => {
          toast({
            title: OTHER_TABS_TITLE,
            description: isPasscodeEnabled()
              ? 'Updating now switches every open AscendEd tab to the new version: this one reloads, and the others reload and need unlocking again the next time you move to another page. Unsaved Data Entry work is kept. Or close the other tabs first, then tap Reload.'
              : 'Updating now switches every open AscendEd tab to the new version: this one reloads, and the others reload the next time you move to another page. Unsaved Data Entry work is kept. Or close the other tabs first, then tap Reload.',
            duration: Infinity,
            action: <ToastAction altText="Update all open tabs" onClick={() => { void applyUpdate(reg, false); }}>Update all tabs</ToastAction>,
          });
        },
        onFailed: () => {
          toast({
            title: UPDATE_FAILED_TITLE,
            description: 'The new version could not be put in use just now, so nothing was changed in any tab. Try Reload again, or update all open tabs now.',
            duration: Infinity,
            action: <ToastAction altText="Update all open tabs" onClick={() => { void applyUpdate(reg, false); }}>Update all tabs</ToastAction>,
          });
        },
      });
    };

    const recentlyAutoUpdated = () => {
      try {
        const last = Number(sessionStorage.getItem(LAST_AUTO_UPDATE_KEY));
        return Number.isFinite(last) && Date.now() - last < AUTO_UPDATE_GAP_MS;
      } catch {
        return false;
      }
    };

    // An update notice deferred because another notice is showing; offered when that notice closes
    // (toastsChangedRef below), so the update is never lost and never clobbers the other notice,
    // whether it was first discovered at startup or on a return to the foreground.
    let pendingNotice = false;
    const showNotice = (reg: ServiceWorkerRegistration) => {
      if (otherToastOpen.current) {
        pendingNotice = true;
        return;
      }
      pendingNotice = false;
      toast({
        title: UPDATE_TITLE,
        description: isPasscodeEnabled()
          ? "A new version of AscendEd is ready. Reload updates this tab (you'll need to unlock again); unsaved Data Entry work is kept. If AscendEd is open in other tabs too, you'll be told before anything changes there."
          : "A new version of AscendEd is ready. Reload updates this tab; unsaved Data Entry work is kept. If AscendEd is open in other tabs too, you'll be told before anything changes there.",
        duration: Infinity,
        action: <ToastAction altText="Reload the app" onClick={() => { void reloadFromNotice(reg); }}>Reload</ToastAction>,
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
        // Only when this is the only open tab; otherwise (or if the new version doesn't take control) the notice.
        // The loop guard counts only an update that reloaded the page.
        void applyUpdate(reg, true).then(result => {
          if (result === 'reloaded') return;
          try { sessionStorage.removeItem(LAST_AUTO_UPDATE_KEY); } catch { /* storage unavailable */ }
          showNotice(reg);
        });
      } else {
        showNotice(reg);
      }
    };

    toastsChangedRef.current = () => {
      if (pendingNotice && registration) showNotice(registration);
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
      toastsChangedRef.current = null;
      stopWatching?.();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [toast]);

  return null;
}
