'use client';

import React, { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { DatabaseBackup, Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStudentData } from '@/hooks/use-student-data';
import { useBackup } from '@/hooks/use-backup';
import { useToast } from '@/hooks/use-toast';
import { parseBackup, type AppBackup, type RestoreMode } from '@/lib/backup';
import { plural } from '@/lib/helpers';

export default function BackupRestoreCard() {
  const { students, goalTemplates, sessions, restoreBackup } = useStudentData();
  const { lastBackupAt, backUpNow, isBackingUp } = useBackup();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<AppBackup | null>(null);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    try {
      setPendingBackup(parseBackup(await file.text()));
    } catch (error: any) {
      toast({ title: "Can't restore this file", description: error.message, variant: 'destructive' });
    }
  };

  const handleRestore = (mode: RestoreMode) => {
    if (!pendingBackup) return;
    let summary;
    try {
      summary = restoreBackup(pendingBackup, mode);
    } catch (error) {
      // Storage full: nothing was changed.
      toast({ title: "Couldn't restore the backup", description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
      return;
    }
    setPendingBackup(null);
    setIsConfirmingReplace(false);
    toast({
      title: mode === 'merge' ? 'Backup added' : 'Backup restored',
      description: mode === 'merge'
        ? `Added ${plural(summary.students, 'student')}, ${plural(summary.sessions, 'session')} and ${plural(summary.goalTemplates, 'template')} that weren't already on this device${summary.goals ? `, and ${plural(summary.goals, 'goal')} to students already here` : ''}.`
        : `Loaded ${plural(summary.students, 'student')}, ${plural(summary.sessions, 'session')} and ${plural(summary.goalTemplates, 'template')}.`,
    });
  };

  const backupCounts = pendingBackup?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup &amp; Restore</CardTitle>
        <CardDescription>
          Your data is stored only on this device. Back it up regularly so it isn&apos;t lost if the device is reset,
          replaced, or the app is removed. Backups can also move data to another device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-1 text-sm">
          <p>
            On this device: {plural(students.length, 'student')}, {plural(sessions.length, 'session')},{' '}
            {plural(goalTemplates.length, 'goal template')}.
          </p>
          <p className="text-muted-foreground">
            Last backup:{' '}
            {lastBackupAt
              ? `${format(lastBackupAt, 'PPP p')} (${formatDistanceToNow(lastBackupAt, { addSuffix: true })})`
              : 'never on this device'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={backUpNow} disabled={isBackingUp}>
            {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
            Back Up Now
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Restore from Backup
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChosen}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Backing up saves a file you can keep in Files, Google Drive, or email to yourself. Keep backups somewhere
          secure: they contain student information.
        </p>
      </CardContent>

      <Dialog open={!!pendingBackup && !isConfirmingReplace} onOpenChange={(open) => { if (!open) setPendingBackup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              {pendingBackup && `Backup from ${format(new Date(pendingBackup.exportedAt), 'PPP p')}`}
            </DialogDescription>
          </DialogHeader>
          {backupCounts && (
            <div className="space-y-3 text-sm">
              <p>
                It contains {plural(backupCounts.students.length, 'student')}, {plural(backupCounts.sessions.length, 'session')} and{' '}
                {plural(backupCounts.goalTemplates.length, 'goal template')}.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Add to this device</strong> keeps everything already here and adds anything
                from the backup that isn&apos;t. <strong className="text-foreground">Replace all data</strong> deletes what&apos;s on this
                device and loads the backup instead.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingBackup(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setIsConfirmingReplace(true)}>Replace All Data</Button>
            <Button onClick={() => handleRestore('merge')}>Add to This Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmingReplace} onOpenChange={setIsConfirmingReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              The {plural(students.length, 'student')}, {plural(sessions.length, 'session')} and{' '}
              {plural(goalTemplates.length, 'goal template')} on this device will be deleted and replaced with the backup.
              This can&apos;t be undone. Back up first if you might need the current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleRestore('replace')}
            >
              Replace All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
