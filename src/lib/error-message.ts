// Identifiers that must never reach the browser console or a user-facing error
// surface: student, session and goal IDs, email addresses, and UUIDs. Names
// cannot be pattern-matched out of free text, so call sites must not
// interpolate a student name into an error in the first place; this helper
// strips everything that can be recognised mechanically.
//
// The raw error still belongs somewhere: it goes in the in-memory error log
// (use-error-log, capped at 50 entries, never transmitted) and nowhere else.
// The console mirror in use-error-log and every console call in src log the
// sanitised form only.

/** Shown at the error boundaries instead of the raw error. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Your data is still saved on this device.';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// "Student ID: <token>", "Session ID: <token>", "Goal ID: <token>".
const ID_LABEL_RE = /\b(session|student|goal)\s+id\s*:\s*[^\s,;]+/gi;
// "sessionId: <token>", "studentId=<token>" and the like.
const ID_KEY_RE = /\b(sessionId|studentId|goalId)\s*[:=]\s*['"]?[^\s,'";]+['"]?/gi;
// "Row for session <id> is missing ..." and "for session <id>".
const SESSION_REF_RE = /\bfor\s+session\s+[^\s,;]+/gi;

/** Removes IDs, UUIDs and email addresses from an error message, keeping the rest readable. */
export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(UUID_RE, '[redacted]')
    .replace(EMAIL_RE, '[redacted]')
    .replace(ID_LABEL_RE, (_match, kind: string) => `${kind} ID: [redacted]`)
    .replace(ID_KEY_RE, (_match, key: string) => `${key}: [redacted]`)
    .replace(SESSION_REF_RE, 'for a session');
}

/** A safe one-line message for a console call or a toast: the sanitised error, or a generic fallback. */
export function toSafeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const clean = sanitizeErrorMessage(raw).trim();
  return clean && clean !== '[object Object]' ? clean : 'An unexpected error occurred.';
}
