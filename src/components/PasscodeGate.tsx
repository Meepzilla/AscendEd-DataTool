'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_NAME } from '@/lib/appConstants';
import TopEdgeBar from '@/components/layout/TopEdgeBar';
import {
  MIN_PASSCODE_LENGTH, enablePasscode, eraseProtectedData, getAutoLockMinutes, isPasscodeEnabled,
  isUnlocked, lockNow, unlock,
} from '@/lib/secure-store';
import { needsFirstRunPrompt, needsPasscodeOffer, recordPasscodeDecision } from '@/lib/passcode-onboarding';
import { getLockoutRemainingMs } from '@/lib/attempt-lockout';

// With passcode protection on (Settings), the app opens to this lock screen; the student data is decrypted
// only after the passcode is entered. While unlocked, the app locks again after the chosen minutes without use
// (counting time the app was in the background). The data the app shows isn't loaded until it is unlocked.
//
// Passcode protection is the default for new installs: on a fresh install the app asks for a passcode before
// it opens (or an explicit opt-out), and on a device that already has student data it offers it once
// instead. Existing data is never locked behind a passcode (see passcode-onboarding.ts). Repeated wrong
// passcodes lock the screen for a growing time (see attempt-lockout.ts).

export const PASSCODE_CHANGE_EVENT = 'ascended-passcode-change';

type Status = 'checking' | 'locked' | 'open' | 'setup' | 'offer';

export default function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [protectedOn, setProtectedOn] = useState(false);
  // "Remind me later" on the one-time offer dismisses it for this session only (no decision recorded).
  const offerDismissed = useRef(false);

  useEffect(() => {
    const check = () => {
      setProtectedOn(isPasscodeEnabled());
      if (isUnlocked()) { setStatus('open'); return; }
      if (needsFirstRunPrompt()) { setStatus('setup'); return; }
      if (needsPasscodeOffer() && !offerDismissed.current) { setStatus('offer'); return; }
      setStatus('locked');
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
    return (
      <div className="flex h-full flex-col bg-background">
        <TopEdgeBar />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (status === 'setup') {
    return <FirstRunSetup onDone={() => { window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT)); setStatus('open'); }} />;
  }
  if (status === 'offer') {
    return (
      <PasscodeOffer
        onDone={() => { window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT)); setStatus('open'); }}
        onLater={() => { offerDismissed.current = true; setStatus('open'); }}
      />
    );
  }
  return <LockScreen onUnlocked={() => setStatus('open')} />;
}

// The passcode form shared by the first-run setup and the one-time offer: two entries, then
// enablePasscode encrypts whatever student data is already on the device and records the choice.
function SetPasscodeForm({ onEnabled }: { onEnabled: () => void }) {
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (passcode.length < MIN_PASSCODE_LENGTH) { setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`); return; }
    if (passcode !== confirm) { setError("The passcodes don't match."); return; }
    setBusy(true);
    setError('');
    try {
      await enablePasscode(passcode);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error && err.name === 'QuotaExceededError'
        ? "There isn't enough storage space to do this. Back up, then delete old sessions to make room."
        : err instanceof Error && err.message.includes('at least')
          ? err.message
          : "This device couldn't set a passcode. Make sure the app is opened from its https address, then try again.");
      return;
    }
    recordPasscodeDecision('passcode');
    onEnabled();
  }, [passcode, confirm, busy, onEnabled]);

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="setup-passcode">Passcode (at least {MIN_PASSCODE_LENGTH} characters)</Label>
        <Input id="setup-passcode" type="password" autoComplete="new-password" autoFocus value={passcode}
          onChange={e => { setPasscode(e.target.value); setError(''); }} disabled={busy} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="setup-passcode-confirm">Enter it again</Label>
        <Input id="setup-passcode-confirm" type="password" autoComplete="new-password" value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }} disabled={busy} />
      </div>
      <p className="text-xs text-muted-foreground">A longer passcode with letters is much harder to guess than a short number. Keep it somewhere safe: it can&apos;t be recovered if it is forgotten.</p>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" className="w-full" disabled={!passcode || !confirm || busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {busy ? 'Setting up…' : 'Set passcode and continue'}
      </Button>
    </form>
  );
}

function SetupShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TopEdgeBar />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6 shadow-lg">
          <div className="flex flex-col items-center gap-2 text-center">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{intro}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// First run on a fresh install: the app does not open until a passcode is set or the user explicitly
// continues without one, after acknowledging the data will not be encrypted.
function FirstRunSetup({ onDone }: { onDone: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <SetupShell
      title="Protect student data on this device"
      intro={`${APP_NAME} keeps student information only on this device. A passcode encrypts it, so it can only be opened with the passcode. Without one, anyone who opens the app on this device can see student names, goals and session notes.`}
    >
      <SetPasscodeForm onEnabled={onDone} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox id="setup-opt-out" checked={acknowledged} onCheckedChange={v => setAcknowledged(v === true)} />
          <Label htmlFor="setup-opt-out" className="text-sm font-normal leading-snug">
            I understand student data on this device will not be encrypted, and anyone who opens the app will be able to see it.
          </Label>
        </div>
        <Button
          type="button" variant="outline" className="w-full" disabled={!acknowledged}
          onClick={() => { recordPasscodeDecision('opted-out'); onDone(); }}
        >
          Continue without a passcode
        </Button>
        <p className="text-center text-xs text-muted-foreground">You can turn passcode protection on later in Settings → Passcode Protection.</p>
      </div>
    </SetupShell>
  );
}

// One-time offer on a device that already has student data: setting a passcode encrypts it, but the
// data stays accessible without one, and the offer can be put off for this session.
function PasscodeOffer({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <SetupShell
      title="Passcode protection is now the default"
      intro="This device already has student data, and nothing about it changes: it stays open without a passcode unless you set one. A passcode encrypts the data on the device, so it can only be opened with the passcode."
    >
      {showForm ? (
        <div className="space-y-3">
          <SetPasscodeForm onEnabled={onDone} />
          <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForm(false)}>Back</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="button" className="w-full" onClick={() => setShowForm(true)}>Set up a passcode</Button>
          <Button
            type="button" variant="outline" className="w-full"
            onClick={() => { recordPasscodeDecision('opted-out'); onDone(); }}
          >
            Continue without a passcode
          </Button>
          <Button type="button" variant="link" className="w-full" onClick={onLater}>Remind me later</Button>
          <p className="text-center text-xs text-muted-foreground">You can also turn it on any time in Settings → Passcode Protection.</p>
        </div>
      )}
    </SetupShell>
  );
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
    let ok: boolean;
    try {
      ok = await unlock(passcode);
    } catch {
      // Encryption isn't available (e.g. the page isn't served over https) or the stored settings are damaged.
      setBusy(false);
      setError('This device couldn\'t unlock the data. Make sure the app is opened from its https address, then try again.');
      return;
    }
    if (ok) {
      onUnlocked();
      return;
    }
    // A short pause after a wrong passcode slows down guessing.
    await new Promise(resolve => setTimeout(resolve, 1000));
    setBusy(false);
    setPasscode('');
    const remainingMs = getLockoutRemainingMs('passcode');
    if (remainingMs > 0) {
      const minutes = Math.ceil(remainingMs / 60_000);
      setError(`Too many wrong passcodes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    } else {
      setError('Wrong passcode.');
    }
  }, [passcode, busy, onUnlocked]);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
    <TopEdgeBar />
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
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
    </div>
  );
}
