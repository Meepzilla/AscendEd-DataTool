'use client';

import { useSyncExternalStore } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearStorageFailure, getStorageFailures, subscribeStorageFailures } from '@/lib/storage-failure';

// A persistent warning for storage failures that a toast alone would let slip past: a save that
// silently fell back to "this visit only" (full quota, private browsing, storage turned off) stays
// listed here, on every page, until the save lands or the user dismisses it. Dismissing only
// acknowledges it — the next failed save records it again.
export default function StorageFailureBanner() {
  const failures = useSyncExternalStore(subscribeStorageFailures, getStorageFailures);
  if (failures.length === 0) return null;
  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6 lg:px-8" role="alert" aria-live="assertive">
      {failures.map(failure => (
        <Alert key={failure.source} variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>
            {failure.label} could not be saved{ failure.quota ? ' — storage is full' : '' }
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{failure.detail}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => clearStorageFailure(failure.source)}>
                <X className="mr-1 h-4 w-4" aria-hidden /> Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
