'use client';

import React, { useEffect, useRef, useState } from 'react';
import TopEdgeBar from '@/components/layout/TopEdgeBar';
import PasscodeScreens from './passcode/PasscodeScreens';
import { getAutoLockMinutes, isPasscodeEnabled, isUnlocked, lockNow, PASSCODE_CONFIG_KEY, PASSCODE_ERASED_KEY, removeStoredStudentLinkedPrefs } from '@/lib/secure-store';
import { DATA_CHANGED_CHANNEL, isOwnDataChangedMessage } from '@/lib/data-transaction';
import { needsFirstRunPrompt, needsPasscodeOffer, passcodeGateStatus } from '@/lib/passcode-onboarding';

// With passcode protection on (Settings), the app opens to this lock screen; the student data is decrypted
// only after the passcode is entered. While unlocked, the app locks again after the chosen minutes without use
// (counting time the app was in the background). The data the app shows isn't loaded until it is unlocked.
//
// Passcode protection is the default for new installs: on a fresh install the app asks for a passcode before
// it opens (or an explicit opt-out), and on a device that already has student data it offers it once
// instead. Existing data is never locked behind a passcode (see passcode-onboarding.ts). Repeated wrong
// passcodes lock the screen for a growing time (see attempt-lockout.ts).

export const PASSCODE_CHANGE_EVENT = 'ascended-passcode-change';

// PasscodeScreens is imported statically, not lazily: this gate sits above every route error boundary, so a
// lazy chunk that failed to load (offline, or pruned from the service worker cache by a newer version) would
// throw here with no recovery short of a full reload, and the user could not reach passcode entry at all.

type Status = 'checking' | 'locked' | 'open' | 'setup' | 'offer';

const LoadingGate = () => (
  <div className="flex h-full flex-col bg-background">
    <TopEdgeBar />
    <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>
  </div>
);

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [protectedOn, setProtectedOn] = useState(false);
  // "Remind me later" on the one-time offer dismisses it for this session only (no decision recorded).
  const offerDismissed = useRef(false);

  useEffect(() => {
    const check = () => {
      const passcodeOn = isPasscodeEnabled();
      // Student-linked preferences stay out of plain storage while protection is on (copies written before it
      // was turned on, in this tab or another, are removed here).
      if (passcodeOn) removeStoredStudentLinkedPrefs();
      setProtectedOn(passcodeOn);
      setStatus(passcodeGateStatus({
        passcodeOn,
        unlocked: isUnlocked(),
        firstRun: !passcodeOn && needsFirstRunPrompt(),
        offer: !passcodeOn && needsPasscodeOffer(),
        offerPutOff: offerDismissed.current,
      }));
    };
    check();
    const onStorage = (event: StorageEvent) => {
      if (event.key === PASSCODE_ERASED_KEY && event.newValue) {
        // Another tab erased all data on this device: reload immediately so this tab drops in-memory PHI.
        setStatus('checking');
        window.location.reload();
        return;
      }
      if (event.key === PASSCODE_CONFIG_KEY || event.key === null) {
        check();
      }
    };
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(DATA_CHANGED_CHANNEL);
        channel.onmessage = (event: MessageEvent) => {
          if (isOwnDataChangedMessage(event.data)) return;
          if ((event.data as { type?: string } | null)?.type === 'data-erased') {
            setStatus('checking');
            window.location.reload();
          }
        };
      }
    } catch {
      /* BroadcastChannel unavailable */
    }
    window.addEventListener(PASSCODE_CHANGE_EVENT, check);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PASSCODE_CHANGE_EVENT, check);
      window.removeEventListener('storage', onStorage);
      try { channel?.close(); } catch { /* ignore */ }
    };
  }, []);

  // Auto-lock after inactivity.
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (status !== 'open' || !protectedOn) return;
    const touch = () => { lastActive.current = Date.now(); };
    // Hide student data immediately before awaiting flushWrites / SW activation in lockNow().
    const triggerLock = () => {
      setStatus('checking');
      void lockNow();
    };
    // "As soon as the app is put away" (0): lock when the page is hidden (another app opened, the screen
    // turned off), and after 5 minutes without use while it stays open.
    const idleMinutes = () => getAutoLockMinutes() || 5;
    const checkIdle = () => {
      if (Date.now() - lastActive.current > idleMinutes() * 60_000) triggerLock();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && getAutoLockMinutes() === 0) triggerLock();
      else checkIdle();
    };
    touch();
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(checkIdle, 30_000);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [status, protectedOn]);

  if (status === 'open') return <>{children}</>;
  if (status === 'checking') return <LoadingGate />;

  return (
    <PasscodeScreens
      mode={status}
      onDone={() => { window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT)); setStatus('open'); }}
      onLater={() => { offerDismissed.current = true; setStatus('open'); }}
      onUnlocked={() => setStatus('open')}
    />
  );
}
