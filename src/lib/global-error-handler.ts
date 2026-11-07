// The global error handler: uncaught exceptions and unhandled promise rejections, which previously
// vanished (or surfaced only through a route error boundary), are logged to the in-memory error log
// (capped at 50 entries, never transmitted; see use-error-log). The raw message goes in the log only —
// the log's console mirror sanitises it, so student IDs and other identifiers never reach the console.
//
// Installed once per page load, where the providers mount (GlobalErrorHandler, inside
// ErrorLogProvider). Installing twice would log every error twice, so install is idempotent per
// target and the cleanup only removes the listeners when nothing else is using them.
//
// What is logged:
// - Runtime errors (window 'error' events whose target is the window): message, file, line, column.
// - Resource errors (the same event with an element as its target, e.g. a script that failed to
//   load): the tag and its source. These never reach window.onerror, so the capture-phase listener
//   is what catches them; the listener is one function for both, so a runtime error is never logged
//   twice (window.onerror and an 'error' listener would both fire for it).
// - Unhandled promise rejections: the rejection reason.
// Skipped: cross-origin 'Script error.' with no file or detail — there is nothing actionable in it,
// and logging it would only add noise. Nothing here rethrows or shows the user anything: a toast
// for every uncaught error would be worse than the log.

export interface GlobalErrorLog {
  message: string;
  source: string;
  details?: string;
  type: 'error' | 'warning';
}

export type GlobalErrorLogger = (log: GlobalErrorLog) => void;

interface ErrorEventLike {
  message?: unknown;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: unknown;
  target?: unknown;
}

/** A window 'error' event, described for the log — or null when there is nothing to log. */
export function describeErrorEvent(event: ErrorEventLike): GlobalErrorLog | null {
  const target = event.target as { tagName?: string; src?: string; href?: string } | null | undefined;
  const isWindowTarget =
    !target || typeof target !== 'object' || (target as { tagName?: string }).tagName === undefined;
  if (!isWindowTarget) {
    // A resource that failed to load (a script, an image): the target is the element.
    const tag = (target.tagName ?? 'resource').toLowerCase();
    const src = target.src ?? target.href ?? '';
    return {
      message: `Failed to load a ${tag}${src ? ` (${src})` : ''}.`,
      source: 'window.onerror',
      details: src || undefined,
      type: 'error',
    };
  }
  const message =
    typeof event.message === 'string' && event.message
      ? event.message
      : event.error instanceof Error
        ? event.error.message
        : 'An unexpected error occurred.';
  // A cross-origin script error carries no message, file or line: nothing to act on.
  if (message === 'Script error.' && !event.filename) return null;
  const where = [event.filename, event.lineno !== undefined ? `line ${event.lineno}` : '', event.colno !== undefined ? `column ${event.colno}` : '']
    .filter(Boolean)
    .join(', ');
  return { message, source: 'window.onerror', details: where || undefined, type: 'error' };
}

/** An unhandled promise rejection, described for the log — or null when there is nothing to log. */
export function describeUnhandledRejection(reason: unknown): GlobalErrorLog | null {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (!message || message === 'undefined') return null;
  return { message, source: 'unhandledrejection', type: 'error' };
}

interface EventTargetLike {
  addEventListener(type: string, listener: (event: unknown) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: (event: unknown) => void, options?: boolean | AddEventListenerOptions): void;
}

const installed = new Set<EventTargetLike>();

/**
 * Installs the window error and unhandled-rejection handlers on `target` (the window, in the app).
 * Installing on the same target twice is a no-op that returns a no-op cleanup, so React StrictMode
 * double-mounting cannot double-register. Returns a cleanup that removes the listeners.
 */
export function installGlobalErrorHandlers(target: EventTargetLike, log: GlobalErrorLogger): () => void {
  if (installed.has(target)) return () => {};
  installed.add(target);

  const onError = (event: unknown) => {
    try {
      const described = describeErrorEvent((event ?? {}) as ErrorEventLike);
      if (described) log(described);
    } catch {
      // Logging must never throw.
    }
  };
  const onUnhandledRejection = (event: unknown) => {
    try {
      const described = describeUnhandledRejection((event as { reason?: unknown } | null | undefined)?.reason);
      if (described) log(described);
    } catch {
      // Logging must never throw.
    }
  };
  // Capture phase: resource errors do not bubble, so without capture only runtime errors arrive.
  target.addEventListener('error', onError, true);
  target.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    installed.delete(target);
    target.removeEventListener('error', onError, true);
    target.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
