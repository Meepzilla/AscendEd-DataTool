'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatBytes, type StorageEstimate } from '@/lib/storage-size';

// The storage part of Settings → Backup & Restore: how much this device holds and where the quota stands.
//
// The three lists live as per-record rows in IndexedDB, so the quota is the browser's per-origin quota
// rather than localStorage's ~5 MB, but the data can still outgrow the device. The bar turns amber at 70%
// and red at 90% of quota, with a warning to back up and delete old sessions. The card's own Back Up Now
// button is right below, so these warnings carry no button of their own. (The dashboard's BackupReminder
// still prompts separately.)

/** The "Stored: … of about … available" line and its bar. */
export function StorageUsageLine({ estimate }: { estimate: StorageEstimate | null }) {
  const percent: number | null = estimate?.percent ?? null;

  return (
    <>
      <p aria-live="polite">
        {estimate === null
          ? 'Measuring storage…'
          : <>Stored: <strong>{formatBytes(estimate.bytes)}</strong>
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
    </>
  );
}

/** A warning when storage is over 70% (amber) or 90% (red) full; nothing otherwise. */
export function StorageFullWarning({ estimate }: { estimate: StorageEstimate | null }) {
  const percent: number | null = estimate?.percent ?? null;

  if (estimate === null || estimate.level === 'ok') return null;
  if (estimate.level === 'warn') {
    return (
      <Alert className="border-amber-500/60">
        <TriangleAlert className="h-4 w-4 !text-amber-600" />
        <AlertTitle>Storage is over 70% full</AlertTitle>
        <AlertDescription>
          Your data uses {percent !== null ? `${percent.toFixed(0)}% of` : 'a large share of'} the storage this
          browser allows. Back up your data, then delete old sessions you no longer need.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>Storage is over 90% full</AlertTitle>
      <AlertDescription>
        Your data uses {percent !== null ? `${percent.toFixed(0)}% of` : 'almost all of'} the storage this
        browser allows. Saves may start failing. Back up your data now, then delete old sessions.
      </AlertDescription>
    </Alert>
  );
}
