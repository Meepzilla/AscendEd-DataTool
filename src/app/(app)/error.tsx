'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorLogIfAvailable } from '@/hooks/use-error-log';
import { GENERIC_ERROR_MESSAGE } from '@/lib/error-message';

// Shown instead of a blank page when something on a page fails. The screen shows a generic message
// only: the raw error can carry student IDs and other identifiers, so it goes in the in-memory
// error log (capped at 50 entries, never transmitted) and is never rendered or console-logged.
// The app's data is not affected.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const errorLog = useErrorLogIfAvailable();
  // addErrorLog is stable (useCallback with no dependencies), so this logs the error once
  // even though the provider value itself is a fresh object on every render.
  const addErrorLog = errorLog?.addErrorLog;

  useEffect(() => {
    addErrorLog?.({ message: 'Page error.', source: 'AppError', details: error.message || String(error), type: 'error' });
  }, [error, addErrorLog]);

  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" /> Something went wrong on this page
        </CardTitle>
        <CardDescription>
          Your students and sessions are still saved on this device. Try again, or go back to the previous page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{GENERIC_ERROR_MESSAGE} Details are in the error log, under the app menu.</p>
        {version ? <p className="text-xs text-muted-foreground">Version {version}</p> : null}
        <div className="flex gap-2">
          <Button onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Try Again</Button>
          <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </CardContent>
    </Card>
  );
}
