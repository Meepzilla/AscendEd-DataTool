'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Shown instead of a blank page when something on a page fails. The details help find the cause
// (a photo of this screen is enough); the app's data is not affected.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
          {error.message || String(error)}
          {version ? `\nVersion ${version}` : ''}
        </pre>
        <div className="flex gap-2">
          <Button onClick={reset}><RotateCcw className="mr-2 h-4 w-4" /> Try Again</Button>
          <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </CardContent>
    </Card>
  );
}
