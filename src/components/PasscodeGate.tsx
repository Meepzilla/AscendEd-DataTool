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
  MIN_PASSCODE_LENGTH, enablePasscode, eraseProtectedData, generateRecoveryKey, getAutoLockMinutes, isPasscodeEnabled,
  isUnlocked, lockNow, resetPasscodeWithRecoveryKey, unlock,
} from '@/lib/secure-store';
import { hasExistingStudentData, needsFirstRunPrompt, needsPasscodeOffer, passcodeGateStatus, recordPasscodeDecision, recordBackupDeclinedBeforePasscode, shouldPromptForBackupBeforePasscode } from '@/lib/passcode-onboarding';
import { useAuth } from '@/hooks/use-auth';
import { LAST_BACKUP_KEY, backupFileName, backupFileText, buildBackupFromStorage, isPlaintextBackupAcknowledged, PLAINTEXT_BACKUP_ACKNOWLEDGEMENT } from '@/lib/backup';
import { saveTextFile } from '@/lib/save-file';
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
      const passcodeOn = isPasscodeEnabled();
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
    window.addEventListener(PASSCODE_CHANGE_EVENT, check);
    return () => window.removeEventListener(PASSCODE_CHANGE_EVENT, check);
  }, []);

  // Auto-lock after inactivity.
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (status !== 'open' || !protectedOn) return;
    const touch = () => { lastActive.current = Date.now(); };
    // "As soon as the app is put away" (0): lock when the page is hidden (another app opened, the screen
    // turned off), and after 5 minutes without use while it stays open.
    const idleMinutes = () => getAutoLockMinutes() || 5;
    const checkIdle = () => {
      if (Date.now() - lastActive.current > idleMinutes() * 60_000) lockNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && getAutoLockMinutes() === 0) lockNow();
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
// a backup step when there is data to protect and no backup on record, then a recovery key
// shown once, and only then enablePasscode encrypts whatever student data is already on the
// device and records the choice. The typed passcode is kept in state through every step, so
// the backup prompt never loses it. Skipping the backup needs an explicit acknowledgement,
// and skipping the recovery key is a choice, not a dead end.
type SetupStep = 'passcode' | 'backup' | 'recovery';

function SetPasscodeForm({ onEnabled }: { onEnabled: () => void }) {
  const { currentUser } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<SetupStep>('passcode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Backup step: a password-protected backup first, or an explicit decline after the warning.
  const [backupPassword, setBackupPassword] = useState('');
  const [backupConfirm, setBackupConfirm] = useState('');
  const [noBackupPassword, setNoBackupPassword] = useState(false);
  const [plaintextAck, setPlaintextAck] = useState('');
  const [backupDeclined, setBackupDeclined] = useState(false);
  const [backupIncomplete, setBackupIncomplete] = useState(false);
  // Recovery step: generated once here, shown once, passed to enablePasscode at the end.
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const goRecovery = useCallback(() => {
    setRecoveryKey(generateRecoveryKey());
    setStep('recovery');
  }, []);

  const submitPasscode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (passcode.length < MIN_PASSCODE_LENGTH) { setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`); return; }
    if (passcode !== confirm) { setError("The passcodes don't match."); return; }
    setError('');
    // Nothing to back up on a fresh install, and no prompt when a backup is already on
    // record or the user already declined after the warning: go straight to the recovery key.
    if (hasExistingStudentData() && shouldPromptForBackupBeforePasscode()) setStep('backup');
    else goRecovery();
  }, [passcode, confirm, busy, goRecovery]);

  const exportBackup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (noBackupPassword) {
      if (!isPlaintextBackupAcknowledged(plaintextAck)) {
        setError(`To save without a password, type ${PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} in the box below.`);
        return;
      }
    } else {
      if (backupPassword.length < MIN_PASSCODE_LENGTH) { setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`); return; }
      if (backupPassword !== backupConfirm) { setError("The passwords don't match."); return; }
    }
    setBusy(true);
    setError('');
    try {
      const { backup, incomplete } = await buildBackupFromStorage(currentUser?.uid);
      const saved = await saveTextFile(backupFileName(), await backupFileText(backup, noBackupPassword ? undefined : backupPassword));
      if (!saved) { setBusy(false); return; }
      window.localStorage.setItem(LAST_BACKUP_KEY, backup.exportedAt);
      setBackupIncomplete(incomplete);
      goRecovery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The backup file could not be saved.');
    } finally {
      setBusy(false);
    }
  }, [backupPassword, backupConfirm, noBackupPassword, plaintextAck, busy, currentUser, goRecovery]);

  const declineBackup = useCallback(() => {
    recordBackupDeclinedBeforePasscode();
    goRecovery();
  }, [goRecovery]);

  const finish = useCallback(async (withRecovery: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (withRecovery && recoveryKey) await enablePasscode(passcode, 15, recoveryKey);
      else await enablePasscode(passcode);
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
  }, [passcode, recoveryKey, busy, onEnabled]);

  const copyRecoveryKey = useCallback(async () => {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the key is in a selectable box below, so it can still be copied by hand.
    }
  }, [recoveryKey]);

  if (step === 'backup') {
    return (
      <form onSubmit={exportBackup} className="space-y-3">
        <p className="text-sm">
          Back up first. If the passcode is forgotten, the data on this device can only be got back
          from a backup (or with the recovery key on the next step), so save one now while the data is open.
        </p>
        {!noBackupPassword && (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="setup-backup-password">Backup password (at least {MIN_PASSCODE_LENGTH} characters)</Label>
              <Input id="setup-backup-password" type="password" autoComplete="new-password" value={backupPassword}
                onChange={e => { setBackupPassword(e.target.value); setError(''); }} disabled={busy} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="setup-backup-password-confirm">Enter it again</Label>
              <Input id="setup-backup-password-confirm" type="password" autoComplete="new-password" value={backupConfirm}
                onChange={e => { setBackupConfirm(e.target.value); setError(''); }} disabled={busy} />
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Checkbox id="setup-backup-no-password" checked={noBackupPassword} onCheckedChange={v => { setNoBackupPassword(v === true); setError(''); }} />
          <Label htmlFor="setup-backup-no-password" className="text-sm font-normal leading-snug">
            Save without a password. I&apos;ll keep the file somewhere secure (anyone with the file can read the student data).
          </Label>
        </div>
        {noBackupPassword && (
          <div className="space-y-1">
            <Label htmlFor="setup-backup-plaintext-ack">Type {PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} to confirm an unencrypted backup</Label>
            <Input id="setup-backup-plaintext-ack" autoComplete="off" value={plaintextAck}
              onChange={e => { setPlaintextAck(e.target.value); setError(''); }} disabled={busy}
              placeholder={PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} />
          </div>
        )}
        {backupIncomplete && (
          <p className="text-sm text-destructive" role="alert">Some of this device&apos;s data couldn&apos;t be read, so it isn&apos;t in this backup. Keep your earlier backup files.</p>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? 'Saving backup…' : noBackupPassword ? 'Save Backup' : 'Save Protected Backup'}
        </Button>
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-start gap-2">
            <Checkbox id="setup-backup-decline" checked={backupDeclined} onCheckedChange={v => setBackupDeclined(v === true)} />
            <Label htmlFor="setup-backup-decline" className="text-sm font-normal leading-snug">
              I understand that without a backup, forgetting the passcode means the student data on this device is lost.
            </Label>
          </div>
          <Button type="button" variant="outline" className="w-full" disabled={!backupDeclined || busy} onClick={declineBackup}>
            Continue without a backup
          </Button>
        </div>
      </form>
    );
  }

  if (step === 'recovery') {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Save this recovery key somewhere safe, separate from the passcode. It is the only way back in
          if the passcode is forgotten. It is shown once and never again.
        </p>
        <div className="space-y-1">
          <Label htmlFor="setup-recovery-key">Recovery key</Label>
          <Input id="setup-recovery-key" readOnly value={recoveryKey ?? ''} autoComplete="off"
            onFocus={e => e.target.select()} className="font-mono text-sm" />
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={copyRecoveryKey}>
          {copied ? 'Copied' : 'Copy recovery key'}
        </Button>
        <div className="flex items-start gap-2">
          <Checkbox id="setup-recovery-saved" checked={recoverySaved} onCheckedChange={v => setRecoverySaved(v === true)} />
          <Label htmlFor="setup-recovery-saved" className="text-sm font-normal leading-snug">
            I have written down the recovery key somewhere safe.
          </Label>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="button" className="w-full" disabled={!recoverySaved || busy} onClick={() => finish(true)}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? 'Setting up…' : 'Set passcode and continue'}
        </Button>
        <Button type="button" variant="link" className="w-full" disabled={busy} onClick={() => finish(false)}>
          Continue without a recovery key
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitPasscode} className="space-y-3">
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
        {busy ? 'Setting up…' : 'Continue'}
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
            {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// The second, deliberate step before going without a passcode: it says plainly what is left unprotected, puts
// "Set a passcode instead" first, and only lets the opt-out button work after a few seconds, so the insecure
// choice can't be made by a quick double tap or by accident.
export const OPT_OUT_DELAY_SECONDS = 5;
function OptOutConfirm({ onConfirm, onBack }: { onConfirm: () => void; onBack: () => void }) {
  const [wait, setWait] = useState(OPT_OUT_DELAY_SECONDS);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  return (
    <div className="space-y-3" role="alertdialog" aria-labelledby="opt-out-title" aria-describedby="opt-out-desc">
      <h2 id="opt-out-title" className="text-base font-semibold">Continue without encryption?</h2>
      <div id="opt-out-desc" className="space-y-2 text-sm text-muted-foreground">
        <p>Without a passcode, student names, goals, session notes and IEP dates are stored unencrypted on this device.</p>
        <p>Anyone who picks up this device and opens {APP_NAME}, or copies the browser&apos;s storage, can read them. The app won&apos;t lock.</p>
      </div>
      <Button type="button" className="w-full" onClick={onBack} autoFocus>Set a passcode instead</Button>
      <Button type="button" variant="outline" className="w-full" disabled={wait > 0} onClick={onConfirm}>
        {wait > 0 ? `Continue without a passcode (${wait})` : 'Continue without a passcode'}
      </Button>
    </div>
  );
}

// First run on a fresh install: the app does not open until a passcode is set or the user explicitly
// continues without one, after acknowledging the data will not be encrypted.
function FirstRunSetup({ onDone }: { onDone: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <SetupShell title="Protect student data on this device" intro="">
        <OptOutConfirm
          onBack={() => { setConfirming(false); setAcknowledged(false); }}
          onConfirm={() => { recordPasscodeDecision('opted-out'); onDone(); }}
        />
      </SetupShell>
    );
  }

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
          onClick={() => setConfirming(true)}
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
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <SetupShell title="Passcode protection is now the default" intro="">
        <OptOutConfirm
          onBack={() => { setConfirming(false); setShowForm(true); }}
          onConfirm={() => { recordPasscodeDecision('opted-out'); onDone(); }}
        />
      </SetupShell>
    );
  }

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
            onClick={() => setConfirming(true)}
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
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [newConfirm, setNewConfirm] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

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
          <div className="space-y-4 text-sm">
            <div className="space-y-3">
              <p>
                If you saved a recovery key when the passcode was set up, it opens the data and lets
                you set a new passcode. The same recovery key keeps working afterwards.
              </p>
              <div className="space-y-1">
                <Label htmlFor="recovery-key">Recovery key</Label>
                <Input id="recovery-key" value={recoveryKey} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  onChange={e => { setRecoveryKey(e.target.value); setRecoveryError(''); }} disabled={recoveryBusy} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recovery-new-passcode">New passcode (at least {MIN_PASSCODE_LENGTH} characters)</Label>
                <Input id="recovery-new-passcode" type="password" autoComplete="new-password" value={newPasscode}
                  onChange={e => { setNewPasscode(e.target.value); setRecoveryError(''); }} disabled={recoveryBusy} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recovery-new-passcode-confirm">Enter the new passcode again</Label>
                <Input id="recovery-new-passcode-confirm" type="password" autoComplete="new-password" value={newConfirm}
                  onChange={e => { setNewConfirm(e.target.value); setRecoveryError(''); }} disabled={recoveryBusy} />
              </div>
              {recoveryError && <p className="text-sm text-destructive" role="alert">{recoveryError}</p>}
              <Button
                type="button" className="w-full"
                disabled={!recoveryKey || !newPasscode || !newConfirm || recoveryBusy}
                onClick={async () => {
                  if (newPasscode.length < MIN_PASSCODE_LENGTH) { setRecoveryError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`); return; }
                  if (newPasscode !== newConfirm) { setRecoveryError("The passcodes don't match."); return; }
                  setRecoveryBusy(true);
                  setRecoveryError('');
                  try {
                    await resetPasscodeWithRecoveryKey(recoveryKey, newPasscode);
                    onUnlocked();
                  } catch (err) {
                    setRecoveryError(err instanceof Error ? err.message : 'That recovery key is not right.');
                    setRecoveryBusy(false);
                  }
                }}
              >
                {recoveryBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {recoveryBusy ? 'Unlocking…' : 'Unlock with recovery key and set new passcode'}
              </Button>
            </div>
            <div className="space-y-3 border-t pt-3">
              <p>
                Without the passcode or the recovery key, the data can&apos;t be decrypted. The only way to use the
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
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
