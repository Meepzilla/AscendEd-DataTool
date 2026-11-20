// Coordinates Service Worker updates so a newly deployed build never takes over an open tab
// mid-session. A waiting Service Worker stays in the waiting state (leaving the active worker's
// precache and chunks intact, so Next.js client-side tab switches keep seeing the matching buildId
// and never fall back to a full-page reload that would wipe the in-memory passcode key).
//
// Updates activate only when:
// - all tabs are closed and the app is reopened (browser default),
// - the user clicks Reload on the "App updated" notification (SKIP_WAITING), or
// - the app is already reloading to lock while visible and no other tab is open (SKIP_WAITING_IF_ALONE).

export const SW_SKIP_WAITING_MESSAGE = 'SKIP_WAITING';
export const SW_SKIP_WAITING_IF_ALONE_MESSAGE = 'SKIP_WAITING_IF_ALONE';

export interface SwLike {
  state: string;
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown): void;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export interface SwRegistrationLike {
  waiting: SwLike | null;
  installing: SwLike | null;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export interface SwContainerLike {
  controller: SwLike | null;
  getRegistration?: () => Promise<SwRegistrationLike | undefined>;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

/**
 * Watches a Service Worker registration for a waiting update (already waiting when mounted,
 * currently installing, or found later) and calls `onUpdateReady` once per waiting worker.
 * Never fires on the very first install (when no controller exists yet). Returns a cleanup
 * function that removes all listeners.
 */
export function watchForWaitingUpdate(
  container: SwContainerLike,
  registration: SwRegistrationLike,
  onUpdateReady: (waiting: SwLike) => void,
): () => void {
  let notified: SwLike | null = null;
  const cleanups: (() => void)[] = [];

  const notify = (worker: SwLike) => {
    if (notified === worker) return;
    // Only notify when an older Service Worker is already controlling the page (not first install).
    if (!container.controller || container.controller === worker) return;
    notified = worker;
    onUpdateReady(worker);
  };

  const trackInstalling = (worker: SwLike | null) => {
    if (!worker) return;
    if (worker.state === 'installed') {
      notify(worker);
      return;
    }
    const onStateChange = () => {
      if (worker.state === 'installed') {
        worker.removeEventListener('statechange', onStateChange);
        notify(worker);
      } else if (worker.state === 'redundant' || worker.state === 'activated') {
        worker.removeEventListener('statechange', onStateChange);
      }
    };
    worker.addEventListener('statechange', onStateChange);
    cleanups.push(() => worker.removeEventListener('statechange', onStateChange));
  };

  if (registration.waiting) {
    notify(registration.waiting);
  }
  trackInstalling(registration.installing);

  const onUpdateFound = () => {
    trackInstalling(registration.installing);
  };
  registration.addEventListener('updatefound', onUpdateFound);
  cleanups.push(() => registration.removeEventListener('updatefound', onUpdateFound));

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Asks a waiting Service Worker to activate and waits for it to take control (or for the worker
 * to decline when `onlyIfAlone` is set and another tab is open, or for `timeoutMs` to elapse).
 * Returns true if the controller changed, false otherwise.
 */
export function activateWaitingUpdate(
  container: SwContainerLike,
  waiting: SwLike,
  options?: { onlyIfAlone?: boolean; timeoutMs?: number },
): Promise<boolean> {
  const onlyIfAlone = options?.onlyIfAlone ?? false;
  const timeoutMs = options?.timeoutMs ?? 2000;

  return new Promise<boolean>((resolve) => {
    let done = false;
    let channel: MessageChannel | null = null;

    const finish = (activated: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      container.removeEventListener('controllerchange', onControllerChange);
      waiting.removeEventListener('statechange', onStateChange);
      if (channel) {
        channel.port1.onmessage = null;
        channel.port1.close();
      }
      resolve(activated);
    };

    const onControllerChange = () => finish(true);
    const onStateChange = () => {
      if (waiting.state === 'redundant') finish(false);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    container.addEventListener('controllerchange', onControllerChange);
    waiting.addEventListener('statechange', onStateChange);

    try {
      if (onlyIfAlone) {
        if (typeof MessageChannel !== 'undefined') {
          channel = new MessageChannel();
          channel.port1.onmessage = (event: MessageEvent) => {
            if (event.data && (event.data as { activated?: unknown }).activated === false) finish(false);
          };
          waiting.postMessage({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE }, [channel.port2]);
        } else {
          waiting.postMessage({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE });
        }
      } else {
        waiting.postMessage({ type: SW_SKIP_WAITING_MESSAGE });
      }
    } catch {
      finish(false);
    }
  });
}

/**
 * When the app is already about to reload (e.g. locking), activates any waiting Service Worker
 * first if the page is visible and no other tab is open, so the reload lands on the new version
 * cleanly. Skips when hidden (e.g. iOS put-away auto-lock) so locking reloads immediately.
 */
export async function activateWaitingUpdateBeforeReload(timeoutMs = 500): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.waiting) return false;
    return await activateWaitingUpdate(navigator.serviceWorker, registration.waiting, {
      onlyIfAlone: true,
      timeoutMs,
    });
  } catch {
    return false;
  }
}
