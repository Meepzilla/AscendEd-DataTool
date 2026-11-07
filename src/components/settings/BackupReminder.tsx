'use client';

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import { useBackup } from '@/hooks/use-backup';
import { useStorageSize } from '@/hooks/use-storage-size';
import { formatBytes } from '@/lib/storage-size';
import BackUpNowButton from './BackUpNowButton';

const REMIND_AFTER_DAYS = 7;

/**
 * Dashboard reminder shown when there is data on this device and it hasn't been backed up
 * in the last week — or when storage itself is pressing: past 70% of quota, or past 3 MB
 * stored, even when the last backup was recent.
 */
export default function BackupReminder() {
  const { students, sessions, goalTemplates } = useStudentData();
  const { lastBackupAt } = useBackup();
  const { estimate } = useStorageSize(`${students.length}/${sessions.length}/${goalTemplates.length}`);

  const hasData = students.length > 0 || sessions.length > 0;
  const isOverdue = !lastBackupAt || Date.now() - lastBackupAt.getTime() > REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const sizePressing = !!estimate && (estimate.level !== 'ok' || estimate.over3MB);
  if (!hasData || (!isOverdue && !sizePressing)) return null;

  const sizeText = sizePressing && estimate
    ? [
        estimate.over3MB ? `has passed ${formatBytes(3 * 1024 * 1024)}` : null,
        estimate.level !== 'ok'
          ? `is using ${estimate.percent !== null ? `${estimate.percent.toFixed(0)}% of` : 'a large share of'} the storage this browser allows`
          : null,
      ].filter(Boolean).join(' and ')
    : null;

  return (
    <Alert className="border-primary/60">
      <TriangleAlert className="h-4 w-4 !text-primary" />
      <AlertTitle>Back up your data</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {sizeText
            ? `Your stored data ${sizeText}. `
            : lastBackupAt
              ? `The last backup on this device was ${formatDistanceToNow(lastBackupAt, { addSuffix: true })}. `
              : "This device's data hasn't been backed up yet. "}
          Data is stored only on this device, so a backup is the only way to recover it if the device is lost or reset.
        </p>
        <div className="flex flex-wrap gap-2">
          <BackUpNowButton size="sm" />
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings">Backup Settings</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
