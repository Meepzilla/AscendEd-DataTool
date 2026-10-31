'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  MIN_PASSCODE_LENGTH, changePasscode, disablePasscode, enablePasscode, getAutoLockMinutes, isPasscodeEnabled,
  lockNow, setAutoLockMinutes,
} from '@/lib/secure-store';
import { PASSCODE_CHANGE_EVENT } from '@/components/PasscodeGate';

// Settings → Passcode Protection: turn encryption of the student data on or off, change the passcode, pick the
// auto-lock time, or lock now.

type Mode = null | 'enable' | 'change' | 'disable';
const AUTO_LOCK_OPTIONS = [5, 15, 30, 60];

export default function PasscodeCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoLock, setAutoLock] = useState(15);

  useEffect(() => {
    setEnabled(isPasscodeEnabled());
    setAutoLock(getAutoLockMinutes());
  }, []);

  const reset = () => { setMode(null); setCurrent(''); setNext(''); setConfirm(''); setError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if ((mode === 'enable' || mode === 'change') && next.length < MIN_PASSCODE_LENGTH) {
      setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`);
      return;
    }
    if ((mode === 'enable' || mode === 'change') && next !== confirm) {
      setError("The passcodes don't match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === 'enable') await enablePasscode(next, autoLock);
      if (mode === 'change') await changePasscode(current, next);
      if (mode === 'disable') await disablePasscode(current);
      const on = isPasscodeEnabled();
      setEnabled(on);
      window.dispatchEvent(new Event(PASSCODE_CHANGE_EVENT));
      toast({
        title: mode === 'enable' ? 'Passcode protection is on' : mode === 'change' ? 'Passcode changed' : 'Passcode protection is off',
        description: mode === 'enable'
          ? "Student data on this device is now encrypted. Keep the passcode somewhere safe: it can't be recovered."
          : mode === 'disable' ? 'Student data on this device is no longer encrypted.' : undefined,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error && err.name !== 'QuotaExceededError' ? err.message : "There isn't enough storage space to do this. Back up, then delete old sessions to make room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Passcode Protection</CardTitle>
        <CardDescription>
          Encrypts the student data stored on this device (students, sessions and unsaved Data Entry work) so it can only be
          opened with a passcode. The app asks for the passcode when it opens and locks again after a while without use.
          The passcode can&apos;t be recovered if it is forgotten, so back up first and keep the passcode somewhere safe.
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

        {mode !== null && (
          <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
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
                {mode === 'enable' ? 'Encrypt and Turn On' : mode === 'change' ? 'Change Passcode' : 'Decrypt and Turn Off'}
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={busy}>Cancel</Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="auto-lock" className="text-sm">Lock after</Label>
          <Select value={String(autoLock)} onValueChange={v => { const m = Number(v); setAutoLock(m); setAutoLockMinutes(m); }}>
            <SelectTrigger id="auto-lock" className="w-auto min-w-40 gap-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_OPTIONS.map(m => <SelectItem key={m} value={String(m)}>{m} minutes without use</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
