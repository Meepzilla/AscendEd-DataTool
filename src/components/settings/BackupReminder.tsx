'use client';

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { DatabaseBackup, Loader2, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { useBackup } from '@/hooks/use-backup';

const REMIND_AFTER_DAYS = 7;

/**
 * Dashboard reminder shown when there is data on this device and it hasn't been backed up
 * in the last week.
 */
export default function BackupReminder() {
  const { students, sessions } = useStudentData();
  const { lastBackupAt, backUpNow, isBackingUp } = useBackup();

  const hasData = students.length > 0 || sessions.length > 0;
  const isOverdue = !lastBackupAt || Date.now() - lastBackupAt.getTime() > REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000;
  if (!hasData || !isOverdue) return null;

  return (
    <Alert className="border-primary/60">
      <TriangleAlert className="h-4 w-4 !text-primary" />
      <AlertTitle>Back up your data</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {lastBackupAt
            ? `The last backup on this device was ${formatDistanceToNow(lastBackupAt, { addSuffix: true })}.`
            : "This device's data hasn't been backed up yet."}{' '}
          Data is stored only on this device, so a backup is the only way to recover it if the device is lost or reset.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={backUpNow} disabled={isBackingUp}>
            {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
            Back Up Now
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">Backup Settings</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
