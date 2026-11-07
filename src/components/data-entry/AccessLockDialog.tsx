'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PIN_PATTERN, checkAccessPin, setAccessPin } from '@/lib/access-pin';
import { getLockoutRemainingMs } from '@/lib/attempt-lockout';

// Choosing the PIN the first time the Student Access Lock is turned on, and entering it to turn the lock off.
// A forgotten PIN unlocks only the current Data Entry session, after discarding the unsaved entries; the
// stored PIN stays set, so the next lock still needs it.

export type AccessLockDialogMode = 'set' | 'unlock' | null;

interface AccessLockDialogProps {
  uid: string | undefined;
  mode: AccessLockDialogMode;
  onClose: () => void;
  /** The PIN was set (mode 'set') or entered correctly (mode 'unlock'). */
  onDone: () => void;
  onForgot: () => void;
}

const AccessLockDialog: React.FC<AccessLockDialogProps> = ({ uid, mode, onClose, onDone, onForgot }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    setPin(''); setConfirmPin(''); setError(''); setForgot(false);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'set') {
      if (!PIN_PATTERN.test(pin)) { setError('Use 4 to 8 digits.'); return; }
      if (pin !== confirmPin) { setError("The PINs don't match."); return; }
      if (!(await setAccessPin(uid, pin))) { setError("The PIN couldn't be saved (storage is full)."); return; }
      onDone();
    } else if (await checkAccessPin(uid, pin)) {
      onDone();
    } else {
      const remainingMs = getLockoutRemainingMs('access-pin');
      if (remainingMs > 0) {
        const minutes = Math.ceil(remainingMs / 60_000);
        setError(`Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      } else {
        setError('Wrong PIN.');
      }
      setPin('');
    }
  };

  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

  return (
    <Dialog open={mode !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        {forgot ? (
          <>
            <DialogHeader>
              <DialogTitle>Forgot the PIN?</DialogTitle>
              <DialogDescription>
                Unlocking without the PIN discards everything entered on Data Entry that hasn&apos;t been saved, and
                unlocks only this Data Entry session. The PIN stays set, so you&apos;ll still need it the next time
                you lock. Saved sessions aren&apos;t affected.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setForgot(false)}>Back</Button>
              <Button type="button" variant="destructive" onClick={onForgot}>Discard and unlock</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{mode === 'set' ? 'Choose an unlock PIN' : 'Enter the PIN to unlock'}</DialogTitle>
              <DialogDescription>
                {mode === 'set'
                  ? 'Students will need this PIN to turn off the Student Access Lock. It is kept only on this device.'
                  : 'The Student Access Lock is on.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="access-pin">PIN</Label>
              <Input id="access-pin" type="password" inputMode="numeric" autoComplete="off" autoFocus
                value={pin} onChange={e => { setPin(digits(e.target.value)); setError(''); }} />
              {mode === 'set' && (
                <>
                  <Label htmlFor="access-pin-confirm">Enter it again</Label>
                  <Input id="access-pin-confirm" type="password" inputMode="numeric" autoComplete="off"
                    value={confirmPin} onChange={e => { setConfirmPin(digits(e.target.value)); setError(''); }} />
                </>
              )}
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              {mode === 'unlock' && (
                <Button type="button" variant="link" className="mr-auto px-0" onClick={() => setForgot(true)}>Forgot PIN?</Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit">{mode === 'set' ? 'Set PIN and lock' : 'Unlock'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AccessLockDialog;
