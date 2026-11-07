'use client';

import React, { useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useBackup } from '@/hooks/use-backup';
import { MIN_PASSCODE_LENGTH } from '@/lib/secure-store';
import { isPlaintextBackupAcknowledged, PLAINTEXT_BACKUP_ACKNOWLEDGEMENT } from '@/lib/backup';

// "Back Up Now": asks for a password to protect the backup file (it contains student information). A file without
// a password can still be saved, but only after ticking the box AND typing PLAINTEXT, so an unencrypted backup
// is a deliberate choice. Password protection is the default: the password fields are shown unless that box is ticked.

export default function BackUpNowButton({ size }: { size?: ButtonProps['size'] }) {
  const { backUpNow, isBackingUp } = useBackup();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [noPassword, setNoPassword] = useState(false);
  const [plaintextAck, setPlaintextAck] = useState('');
  const [error, setError] = useState('');

  const close = () => { setOpen(false); setPassword(''); setConfirm(''); setNoPassword(false); setPlaintextAck(''); setError(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noPassword) {
      if (!isPlaintextBackupAcknowledged(plaintextAck)) {
        setError(`To save without a password, type ${PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} in the box below.`);
        return;
      }
    } else {
      if (password.length < MIN_PASSCODE_LENGTH) { setError(`Use at least ${MIN_PASSCODE_LENGTH} characters.`); return; }
      if (password !== confirm) { setError("The passwords don't match."); return; }
    }
    if (await backUpNow(noPassword ? undefined : password)) close();
  };

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} disabled={isBackingUp}>
        {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
        Back Up Now
      </Button>
      <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Protect the backup with a password</DialogTitle>
              <DialogDescription>
                The backup file contains student information. With a password, it is encrypted and can only be restored
                by someone who knows the password. The password can&apos;t be recovered, so keep it somewhere safe.
              </DialogDescription>
            </DialogHeader>
            {!noPassword && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="backup-password">Password (at least {MIN_PASSCODE_LENGTH} characters)</Label>
                  <Input id="backup-password" type="password" autoComplete="new-password" autoFocus value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="backup-password-confirm">Enter it again</Label>
                  <Input id="backup-password-confirm" type="password" autoComplete="new-password" value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }} />
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Checkbox id="backup-no-password" checked={noPassword} onCheckedChange={v => { setNoPassword(v === true); setError(''); }} />
              <Label htmlFor="backup-no-password" className="text-sm font-normal leading-snug">
                Save without a password. I&apos;ll keep the file somewhere secure (anyone with the file can read the student data).
              </Label>
            </div>
            {noPassword && (
              <div className="space-y-1">
                <Label htmlFor="backup-plaintext-ack">Type {PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} to confirm an unencrypted backup</Label>
                <Input id="backup-plaintext-ack" autoComplete="off" value={plaintextAck}
                  onChange={e => { setPlaintextAck(e.target.value); setError(''); }}
                  placeholder={PLAINTEXT_BACKUP_ACKNOWLEDGEMENT} />
                <p className="text-xs text-muted-foreground">
                  The backup is unencrypted plain text: anyone with the file can read every student name, goal, and session note in it.
                </p>
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={isBackingUp}>
                {isBackingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {noPassword ? 'Save Backup' : 'Save Protected Backup'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
