'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_NAME } from '@/lib/appConstants';
import { eraseProtectedData, getAutoLockMinutes, isPasscodeEnabled, isUnlocked, lockNow, unlock } from '@/lib/secure-store';

// With passcode protection on (Settings), the app opens to this lock screen; the student data is decrypted
// only after the passcode is entered. While unlocked, the app locks again after the chosen minutes without use
// (counting time the app was in the background). The data the app shows isn't loaded until it is unlocked.

export const PASSCODE_CHANGE_EVENT = 'ascended-passcode-change';

type Status = 'checking' | 'locked' | 'open';

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [protectedOn, setProtectedOn] = useState(false);

  useEffect(() => {
    const check = () => {
      setProtectedOn(isPasscodeEnabled());
      setStatus(isUnlocked() ? 'open' : 'locked');
    };
    check();
    window.addEventListener(PASSCODE_CHANGE_EVENT, check);
    return () => window.removeEventListener(PASSCODE_CHANGE_EVENT, check);
  }, []);

  // Auto-lock after inactivity.
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (status !== 'open' || !protectedOn) return;
    const touch = () => { lastActive.current = Date.now(); };
    const checkIdle = () => {
      if (Date.now() - lastActive.current > getAutoLockMinutes() * 60_000) lockNow();
    };
    touch();
    window.addEventListener('pointerdown', touch, { passive: true });
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', checkIdle);
    const timer = setInterval(checkIdle, 30_000);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', checkIdle);
      clearInterval(timer);
    };
  }, [status, protectedOn]);

  if (status === 'open') return <>{children}</>;
  if (status === 'checking') {
    return <div className="flex min-h-full items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }
  return <LockScreen onUnlocked={() => setStatus('open')} />;
}

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const [eraseText, setEraseText] = useState('');

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError('');
    const ok = await unlock(passcode);
    if (ok) {
      onUnlocked();
      return;
    }
    // A short pause after a wrong passcode slows down guessing.
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBusy(false);
    setPasscode('');
    setError('Wrong passcode.');
  }, [passcode, busy, onUnlocked]);

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <Lock className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">{APP_NAME} is locked</h1>
          <p className="text-sm text-muted-foreground">Student data on this device is encrypted. Enter the passcode to open it.</p>
        </div>
        {!forgot ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="unlock-passcode">Passcode</Label>
              <Input id="unlock-passcode" type="password" autoComplete="current-password" autoFocus value={passcode}
                onChange={e => { setPasscode(e.target.value); setError(''); }} disabled={busy} />
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={!passcode || busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => setForgot(true)}>Forgot passcode?</Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              The passcode can&apos;t be recovered, and the data can&apos;t be decrypted without it. The only way to use the
              app again is to <strong>erase the student data on this device</strong> and then restore your most recent backup
              (Settings → Backup &amp; Restore).
            </p>
            <div className="space-y-1">
              <Label htmlFor="erase-confirm">Type ERASE to confirm</Label>
              <Input id="erase-confirm" value={eraseText} onChange={e => setEraseText(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setForgot(false); setEraseText(''); }}>Back</Button>
              <Button type="button" variant="destructive" className="flex-1" disabled={eraseText.trim().toUpperCase() !== 'ERASE'}
                onClick={() => { eraseProtectedData(); window.location.reload(); }}>
                Erase and Start Over
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
