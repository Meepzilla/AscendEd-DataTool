'use client';

// Last-resort error screen, used when the app's main layout itself fails. Plain HTML and inline styles,
// since the app's styles and components may be what failed.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#0b1220', color: '#e5e7eb' }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p>Your students and sessions are still saved on this device.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#1f2937', padding: 12, borderRadius: 6, fontSize: 12 }}>
          {error.message || String(error)}
          {process.env.NEXT_PUBLIC_APP_VERSION ? `\nVersion ${process.env.NEXT_PUBLIC_APP_VERSION}` : ''}
        </pre>
        <button onClick={reset} style={{ marginRight: 8, padding: '8px 14px' }}>Try Again</button>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 14px' }}>Reload</button>
      </body>
    </html>
  );
}
