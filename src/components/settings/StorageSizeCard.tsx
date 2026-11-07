'use client';

import React from 'react';
import { Database, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useStudentData } from '@/hooks/use-student-data';
import { useStorageSize } from '@/hooks/use-storage-size';
import { formatBytes, STORAGE_WARN_BYTES } from '@/lib/storage-size';
import { plural } from '@/lib/helpers';
import BackUpNowButton from './BackUpNowButton';

// Settings → Storage: how much this device holds, where the quota stands, and when to back up.
//
// The three lists live as per-record rows in IndexedDB, so the quota is the browser's per-origin
// quota rather than localStorage's ~5 MB, but the data can still outgrow the device. The card shows
// the stored size and the share of quota, warns at 70% (amber) and 90% (red) of quota, and warns
// whenever the stored total passes 3 MB even when the browser reports no quota.
//
// Backup prompt trigger: stored size at or past 70% of quota, or past 3 MB. The prompt is a banner
// in this card (and on the dashboard, via BackupReminder) with a Back Up Now button — it never
// downloads a backup on its own.

export default function StorageSizeCard() {
  const { students, goalTemplates, sessions } = useStudentData();
  const refreshKey = `${students.length}/${goalTemplates.length}/${sessions.length}`;
  const { estimate } = useStorageSize(refreshKey);

  const bytes = estimate?.bytes ?? 0;
  const percent: number | null = estimate?.percent ?? null;
  const needsBackupPrompt = !!estimate && (estimate.level !== 'ok' || estimate.over3MB);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Storage</CardTitle>
        <CardDescription>
          Your students, goal templates and sessions are stored on this device in IndexedDB, one record at a
          time. Back them up regularly so they are not lost if the device is reset or the app is removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>
            On this device: {plural(students.length, 'student')}, {plural(sessions.length, 'session')},{' '}
            {plural(goalTemplates.length, 'goal template')}.
          </p>
          <p aria-live="polite">
            {estimate === null
              ? 'Measuring storage…'
              : <>Stored: <strong>{formatBytes(bytes)}</strong>
                {estimate.quota !== null && percent !== null
                  ? <> of about {formatBytes(estimate.quota)} available ({percent.toFixed(0)}% used)</>
                  : ' (this browser does not report a storage quota)'}
              </>}
          </p>
          {estimate !== null && estimate.quota !== null && percent !== null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar"
              aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}
              aria-label="Storage used">
              <div
                className={estimate.level === 'critical' ? 'h-full bg-destructive' : estimate.level === 'warn' ? 'h-full bg-amber-500' : 'h-full bg-primary'}
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
          )}
        </div>

        {estimate !== null && estimate.level === 'warn' && (
          <Alert className="border-amber-500/60">
            <TriangleAlert className="h-4 w-4 !text-amber-600" />
            <AlertTitle>Storage is over 70% full</AlertTitle>
            <AlertDescription>
              Your data uses {percent !== null ? `${percent.toFixed(0)}% of` : 'a large share of'} the storage this
              browser allows. Back up your data, then delete old sessions you no longer need.
            </AlertDescription>
          </Alert>
        )}
        {estimate !== null && estimate.level === 'critical' && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Storage is over 90% full</AlertTitle>
            <AlertDescription>
              Your data uses {percent !== null ? `${percent.toFixed(0)}% of` : 'almost all of'} the storage this
              browser allows. Saves may start failing. Back up your data now, then delete old sessions.
            </AlertDescription>
          </Alert>
        )}
        {estimate !== null && estimate.over3MB && estimate.level === 'ok' && (
          <Alert className="border-amber-500/60">
            <TriangleAlert className="h-4 w-4 !text-amber-600" />
            <AlertTitle>Your data is over {formatBytes(STORAGE_WARN_BYTES)}</AlertTitle>
            <AlertDescription>
              That is fine for IndexedDB, but a backup is the only way to recover it if this device is lost or
              reset. Back up now if you have not recently.
            </AlertDescription>
          </Alert>
        )}

        {needsBackupPrompt && (
          <Alert className="border-primary/60">
            <TriangleAlert className="h-4 w-4 !text-primary" />
            <AlertTitle>Back up your data</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {estimate.level !== 'ok'
                  ? `Storage is ${percent !== null ? `${percent.toFixed(0)}%` : 'nearly'} full, so a backup is the safest next step.`
                  : 'Your stored data has passed 3 MB, so a backup is worth making now.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <BackUpNowButton size="sm" />
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
