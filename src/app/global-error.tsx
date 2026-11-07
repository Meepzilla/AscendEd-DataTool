'use client';

import { GENERIC_ERROR_MESSAGE } from '@/lib/error-message';

// Last-resort error screen, used when the app's main layout itself fails. Plain HTML and inline styles,
// since the app's styles and components may be what failed. Shows a generic message only: the raw
// error can carry student IDs and other identifiers, so it is never rendered here. The in-memory
// error log is not reachable from this screen (it lives in the layout that failed), so the raw
// error is not recorded anywhere from here either.
export default function GlobalError({ error: _error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#0b1220', color: '#e5e7eb' }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p>Your students and sessions are still saved on this device.</p>
        <p>{GENERIC_ERROR_MESSAGE}</p>
        {version ? <p style={{ fontSize: 12, color: '#9ca3af' }}>Version {version}</p> : null}
        <button onClick={reset} style={{ marginRight: 8, padding: '8px 14px' }}>Try Again</button>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 14px' }}>Reload</button>
      </body>
    </html>
  );
}
