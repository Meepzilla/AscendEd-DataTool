'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStudentData } from '@/hooks/use-student-data';
import {
  MIN_PASSCODE_LENGTH, changePasscode, createRecoveryKey, disablePasscode, enablePasscode, generateRecoveryKey,
  getAutoLockMinutes, hasRecoveryKey, isPasscodeEnabled, lockNow, setAutoLockMinutes,
} from '@/lib/secure-store';
import { hasBackupOnRecord, recordBackupDeclinedBeforePasscode, shouldPromptForBackupBeforePasscode } from '@/lib/passcode-onboarding';
import { PASSCODE_CHANGE_EVENT } from '@/components/PasscodeGate';
import BackUpNowButton from '@/components/settings/BackUpNowButton';

// Settings → Passcode Protection: turn encryption of the student data on or off, change the passcode, pick the
// auto-lock time, or lock now. Turning it on first prompts for a backup (or an explicit decline after the
// warning) and then shows a recovery key once. Lists that cannot be read are quarantined, not a reason to
// refuse a change or turning protection off: they stay exactly as stored, and are named in the result.

type Mode = null | 'enable' | 'change' | 'disable';
type EnableStep = 'form' | 'backup' | 'recovery';
// 0 = lock as soon as the app is put away (another app opened, the screen turned off), and after 5 minutes
// without use while it is open.
const AUTO_LOCK_OPTIONS = [0, 5, 15, 30, 60];
const autoLockLabel = (m: number) => (m === 0 ? 'As soon as the app is put away' : `${m} minutes without use`);

export default function PasscodeCard() {
  const { toast } = useToast();
  const { students, sessions } = useStudentData();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoLock, setAutoLock] = useState(15);
  // Enable flow steps: the typed passcode is kept in state through the backup and recovery steps.
  const [enableStep, setEnableStep] = useState<EnableStep>('form');
  const [backupDone, setBackupDone] = useState(false);
  const [backupDeclined, setBackupDeclined] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [copied, setCopied] = useState(false);
  // Recovery key created here, after protection is already on: shown once, then gone.
  const [hasRecovery, setHasRecovery] = useState(false);
  const [shownRecoveryKey, setShownRecoveryKey] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useEffect(() => {
    setEnabled(isPasscodeEnabled());
    setAutoLock(getAutoLockMinutes());
    setHasRecovery(hasRecoveryKey());
  }, []);

  // A backup saved from the enable step (Back Up Now dispatches this event) marks the step done.
  useEffect(() => {
    if (enableStep !== 'backup') return;
    const read = () => setBackupDone(hasBackupOnRecord());
    read();
    window.addEventListener('ascended-backup-saved', read);
    return () => window.removeEventListener('ascended-backup-saved', read);
  }, [enableStep]);

  const reset = () => {
    setMode(null); setCurrent(''); setNext(''); setConfirm(''); setError('');
    setEnableStep('form'); setBackupDone(false); setBackupDeclined(false);
    setRecoveryKey(null); setRecoverySaved(false);
  };

  const goRecovery = () => {
    setRecoveryKey(generateRecoveryKey());
    setEnableStep('recovery');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The backup and recovery steps have their own buttons: Enter inside them must not restart the flow.
    if (mode === 'enable' && enableStep !== 'form') return;
    setError('');
    if ((mode === 'enable' || mode === 'change') && next.length < MIN_PASSCODE_LENGTH) {
      setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
      return;
    }
    if ((mode === 'enable' || mode === 'change') && next !== confirm) {
      setError("The passcodes don't match.");
      return;
    }
    // Turning protection on goes through the backup step, then the recovery key step, before
    // anything is encrypted. A backup already on record, or a decline already made, skips it,
    // and so does an install with no student or session data yet.
    if (mode === 'enable') {
      if (shouldPromptForBackupBeforePasscode() && students.length + sessions.length > 0) {
        setBackupDone(hasBackupOnRecord());
        setEnableStep('backup');
      } else {
        goRecovery();
      }
      return;
    }
    setBusy(true);
    try {
      const quarantined = mode === 'change'
        ? (await changePasscode(current, next)).quarantined
        : (await disablePasscode(current)).quarantined;
      const on = isPasscodeEnabled();
      setEnabled(on);
      setHasRecovery(hasRecoveryKey());
      window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT));
      toast({
        title: mode === 'change' ? 'Passcode changed' : 'Passcode protection is off',
        description: mode === 'disable'
          ? quarantined.length > 0
            ? `Student data on this device is no longer encrypted. These lists couldn't be read and were left as they are: ${quarantined.map(q => q.label).join(', ')}. Restore a backup in Settings → Backup & Restore to recover them.`
            : 'Student data on this device is no longer encrypted.'
          : quarantined.length > 0
            ? `These lists couldn't be read and were left as they are: ${quarantined.map(q => q.label).join(', ')}. Restore a backup in Settings → Backup & Restore to recover them.`
            : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error && err.name !== 'QuotaExceededError' ? err.message : "There isn't enough storage space to do this. Back up, then delete old sessions to make room.");
    } finally {
      setBusy(false);
    }
  };

  const finishEnable = async (withRecovery: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (withRecovery && recoveryKey) await enablePasscode(next, autoLock, recoveryKey);
      else await enablePasscode(next, autoLock);
      const on = isPasscodeEnabled();
      setEnabled(on);
      setHasRecovery(hasRecoveryKey());
      window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT));
      toast({
        title: 'Passcode protection is on',
        description: "Student data on this device is now encrypted. Keep the passcode somewhere safe: it can't be recovered without the recovery key.",
      });
      reset();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error && err.name !== 'QuotaExceededError' ? err.message : "There isn't enough storage space to do this. Back up, then delete old sessions to make room.");
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryKey = async (key: string | null) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the key is in a selectable box, so it can still be copied by hand.
    }
  };

  const createNewRecoveryKey = async () => {
    setRecoveryBusy(true);
    setError('');
    try {
      setShownRecoveryKey(await createRecoveryKey());
      setHasRecovery(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A recovery key could not be created.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Passcode Protection</CardTitle>
        <CardDescription>
          Encrypts the student data stored on this device (students, sessions and unsaved Data Entry work) so it can only be
          opened with a passcode. The app asks for the passcode when it opens and locks again after a while without use.
          Passcode protection is the default for new installs: the app asks for a passcode the first time it opens, and
          a device that already has student data is offered it once instead. The passcode can&apos;t be recovered if it is
          forgotten, so back up first and keep the passcode somewhere safe, or save the recovery key shown when you turn it on.
          Backup and CSV files aren&apos;t encrypted; store them somewhere protected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Status: <strong>{enabled ? 'On — student data is encrypted' : 'Off'}</strong>
        </p>

        {mode === null && (
          <div className="flex flex-wrap gap-2">
            {!enabled && <Button onClick={() => setMode('enable')}>Turn On…</Button>}
            {enabled && (
              <>
                <Button variant="outline" onClick={() => lockNow()}><Lock className="mr-2 h-4 w-4" />Lock Now</Button>
                <Button variant="outline" onClick={() => setMode('change')}>Change Passcode…</Button>
                <Button variant="outline" onClick={() => setMode('disable')}>Turn Off…</Button>
              </>
            )}
          </div>
        )}

        {enabled && mode === null && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Recovery key</p>
            {shownRecoveryKey ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Save this recovery key somewhere safe, separate from the passcode. It is the only way back in
                  if the passcode is forgotten. It is shown once and never again.
                </p>
                <Input readOnly value={shownRecoveryKey} autoComplete="off" onFocus={e => e.target.select()} className="font-mono text-sm" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => copyRecoveryKey(shownRecoveryKey)}>
                    {copied ? 'Copied' : 'Copy recovery key'}
                  </Button>
                  <Button type="button" onClick={() => setShownRecoveryKey(null)}>I&apos;ve saved it</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {hasRecovery
                    ? 'A recovery key is set up. It was shown once when it was created and can\'t be shown again.'
                    : 'No recovery key is set up. Without one, a forgotten passcode means the data on this device can only be got back from a backup.'}
                </p>
                <Button type="button" variant="outline" disabled={recoveryBusy} onClick={createNewRecoveryKey}>
                  {recoveryBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasRecovery ? 'Create a new recovery key' : 'Create recovery key'}
                </Button>
                {hasRecovery && (
                  <p className="text-xs text-muted-foreground">Creating a new recovery key replaces the old one: the old key will stop working.</p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
        )}

        {mode !== null && (
          <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
            {mode === 'enable' && enableStep === 'backup' && (
              <div className="space-y-3">
                <p className="text-sm">
                  Back up first. If the passcode is forgotten, the data on this device can only be got back
                  from a backup (or with the recovery key on the next step), so save one now while the data is open.
                </p>
                <BackUpNowButton />
                <div className="flex items-start gap-2">
                  <Checkbox id="passcode-backup-decline" checked={backupDeclined} onCheckedChange={v => setBackupDeclined(v === true)} />
                  <Label htmlFor="passcode-backup-decline" className="text-sm font-normal leading-snug">
                    I understand that without a backup, forgetting the passcode means the student data on this device is lost.
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button" disabled={!(backupDone || backupDeclined) || busy}
                    onClick={() => {
                      if (backupDeclined) recordBackupDeclinedBeforePasscode();
                      goRecovery();
                    }}
                  >
                    Continue
                  </Button>
                  <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
                </div>
                {!backupDone && !backupDeclined && (
                  <p className="text-xs text-muted-foreground">Save a backup above, or tick the box to continue without one.</p>
                )}
              </div>
            )}

            {mode === 'enable' && enableStep === 'recovery' && (
              <div className="space-y-3">
                <p className="text-sm">
                  Save this recovery key somewhere safe, separate from the passcode. It is the only way back in
                  if the passcode is forgotten. It is shown once and never again.
                </p>
                <div className="space-y-1">
                  <Label htmlFor="passcode-recovery-key">Recovery key</Label>
                  <Input id="passcode-recovery-key" readOnly value={recoveryKey ?? ''} autoComplete="off"
                    onFocus={e => e.target.select()} className="font-mono text-sm" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => copyRecoveryKey(recoveryKey)}>
                  {copied ? 'Copied' : 'Copy recovery key'}
                </Button>
                <div className="flex items-start gap-2">
                  <Checkbox id="passcode-recovery-saved" checked={recoverySaved} onCheckedChange={v => setRecoverySaved(v === true)} />
                  <Label htmlFor="passcode-recovery-saved" className="text-sm font-normal leading-snug">
                    I have written down the recovery key somewhere safe.
                  </Label>
                </div>
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={!recoverySaved || busy} onClick={() => finishEnable(true)}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Encrypt and Turn On
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => finishEnable(false)}>Continue without a recovery key</Button>
                  <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
                </div>
              </div>
            )}

            {!(mode === 'enable' && enableStep !== 'form') && (
              <>
                {mode !== 'enable' && (
                  <div className="space-y-1">
                    <Label htmlFor="passcode-current">Current passcode</Label>
                    <Input id="passcode-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
                  </div>
                )}
                {mode !== 'disable' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="passcode-new">{mode === 'change' ? 'New passcode' : 'Passcode'} (at least {MIN_PASSCODE_LENGTH} characters)</Label>
                      <Input id="passcode-new" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="passcode-confirm">Enter it again</Label>
                      <Input id="passcode-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">A longer passcode with letters is much harder to guess than a short number.</p>
                  </>
                )}
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {mode === 'enable' ? 'Continue' : mode === 'change' ? 'Change Passcode' : 'Decrypt and Turn Off'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
                </div>
              </>
            )}
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="auto-lock" className="text-sm">Lock after</Label>
          <Select value={String(autoLock)} onValueChange={v => { const m = Number(v); setAutoLock(m); setAutoLockMinutes(m); }}>
            <SelectTrigger id="auto-lock" className="w-auto min-w-40 gap-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_OPTIONS.map(m => <SelectItem key={m} value={String(m)}>{autoLockLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
