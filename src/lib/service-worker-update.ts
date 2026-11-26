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
  options?: { onlyIfAlone?: boolean; timeoutMs?: number; confirmedTimeoutMs?: number },
): Promise<boolean> {
  return activateWaitingUpdateResult(container, waiting, options).then(result => result === 'activated');
}

/** How an attempt to activate a waiting update ended. */
export type ActivationResult = 'activated' | 'other-tabs-open' | 'failed';

/** Once the worker has agreed to take over (alone check passed), how long to wait for it to take control. */
const CONFIRMED_ACTIVATION_TIMEOUT_MS = 3000;

/**
 * activateWaitingUpdate with the reason it didn't activate: 'other-tabs-open' when `onlyIfAlone` was set and the
 * worker declined because another tab or window is open, 'failed' for a timeout, a redundant worker or an error.
 * When the worker says it is activating, the wait is extended to CONFIRMED_ACTIVATION_TIMEOUT_MS, so a reload
 * that follows doesn't land under the old worker while the new one claims the page.
 */
export function activateWaitingUpdateResult(
  container: SwContainerLike,
  waiting: SwLike,
  options?: { onlyIfAlone?: boolean; timeoutMs?: number; confirmedTimeoutMs?: number },
): Promise<ActivationResult> {
  const onlyIfAlone = options?.onlyIfAlone ?? false;
  const timeoutMs = options?.timeoutMs ?? 2000;
  const confirmedTimeoutMs = options?.confirmedTimeoutMs ?? CONFIRMED_ACTIVATION_TIMEOUT_MS;

  return new Promise<ActivationResult>((resolve) => {
    let done = false;
    let channel: MessageChannel | null = null;

    const finish = (result: ActivationResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      container.removeEventListener('controllerchange', onControllerChange);
      waiting.removeEventListener('statechange', onStateChange);
      if (channel) {
        channel.port1.onmessage = null;
        channel.port1.close();
      }
      resolve(result);
    };

    const onControllerChange = () => finish('activated');
    const onStateChange = () => {
      if (waiting.state === 'redundant') finish('failed');
    };

    let timer = setTimeout(() => finish('failed'), timeoutMs);
    container.addEventListener('controllerchange', onControllerChange);
    waiting.addEventListener('statechange', onStateChange);

    try {
      // Both messages carry a reply port when one can be made, so the worker can confirm it is activating and
      // the wait is extended the same way on the update-all path as on the alone path; without the extension a
      // slow activation timed out at the default and the reload landed under the old worker.
      const message = { type: onlyIfAlone ? SW_SKIP_WAITING_IF_ALONE_MESSAGE : SW_SKIP_WAITING_MESSAGE };
      if (typeof MessageChannel !== 'undefined') {
        channel = new MessageChannel();
        channel.port1.onmessage = (event: MessageEvent) => {
          const activated = event.data ? (event.data as { activated?: unknown }).activated : undefined;
          if (activated === false && onlyIfAlone) finish('other-tabs-open');
          else if (activated === true && !done && timeoutMs < confirmedTimeoutMs) {
            clearTimeout(timer);
            timer = setTimeout(() => finish('failed'), confirmedTimeoutMs);
          }
        };
        waiting.postMessage(message, [channel.port2]);
      } else {
        waiting.postMessage(message);
      }
    } catch {
      finish('failed');
    }
  });
}

export interface ApplyUpdateDeps {
  container: SwContainerLike;
  registration: { waiting: SwLike | null };
  /** Saves pending writes before the page reloads. */
  flush: () => Promise<void>;
  reload: () => void;
  /** Take over only when no other tab or window of the app is open (automatic updates). */
  onlyIfAlone: boolean;
}

/**
 * Puts a waiting update in use and reloads, or reports why it didn't. With `onlyIfAlone` (an automatic update) the
 * page reloads only when the new version actually took control, so another open tab is never switched to a new
 * version under its feet, and a worker that won't activate can't cause a reload loop. Without it (the person asked
 * to update all tabs) the page reloads whatever happens, as asked.
 */
export async function applyWaitingUpdate(deps: ApplyUpdateDeps): Promise<'reloaded' | ActivationResult> {
  try {
    await deps.flush();
  } catch {
    // A failed write was already reported; reloading loses nothing more than the failed write did.
  }
  const waiting = deps.registration.waiting;
  if (!waiting) {
    deps.reload();
    return 'reloaded';
  }
  const result = await activateWaitingUpdateResult(deps.container, waiting, { onlyIfAlone: deps.onlyIfAlone });
  if (result === 'activated' || !deps.onlyIfAlone) {
    deps.reload();
    return 'reloaded';
  }
  return result;
}

export interface NoticeReloadHandlers {
  /** Puts the waiting update in use; `onlyIfAlone` false means the user explicitly chose to update all tabs. */
  applyUpdate: (onlyIfAlone: boolean) => Promise<'reloaded' | ActivationResult>;
  /** Another tab is open: tell the user and offer the explicit update-all choice. */
  onOtherTabsOpen: () => void;
  /** The alone attempt failed: tell the user; never escalate to updating all tabs without a fresh choice. */
  onFailed: () => void;
}

/**
 * What tapping Reload on the "App updated" notice does: try to update this tab alone first. Another tab open
 * and a failed attempt are both reported through the handlers, so the user decides what happens next. A failed
 * alone attempt must never silently become an update of every open tab (review finding E1): a tab opened after
 * the alone check, or one the check miscounted, would be taken over by a tap presented as this-tab-only.
 */
export async function reloadFromUpdateNotice(handlers: NoticeReloadHandlers): Promise<void> {
  const result = await handlers.applyUpdate(true);
  if (result === 'other-tabs-open') handlers.onOtherTabsOpen();
  else if (result === 'failed') handlers.onFailed();
}

/**
 * Once the worker has agreed to take over on the lock path, how long to wait for it to take control.
 * The lock reload is the one reload that must land cleanly: reloading under the old worker while the
 * new one is mid-activation can serve a mix of builds. This wait is longer than the notice paths',
 * and activateForLock bounds the whole sequence, so locking can never hang on it.
 */
const LOCK_CONFIRMED_ACTIVATION_TIMEOUT_MS = 10_000;
/** Pause between a failed lock-path attempt and re-checking whether an update is still waiting. */
const LOCK_RECHECK_DELAY_MS = 250;

export type LockActivationOutcome = 'activated' | 'settled' | 'other-tabs-open' | 'gave-up';

export interface LockActivationDeps {
  /** One attempt to activate the waiting update. */
  attempt: () => Promise<ActivationResult>;
  /** Whether an update is still waiting after an attempt. */
  stillWaiting: () => Promise<boolean>;
  delay: (ms: number) => Promise<void>;
}

/**
 * Drives activation for the lock reload. A failed first attempt is not the end: the worker may have
 * confirmed it is activating and simply be slow to take control, so re-check whether an update is
 * still waiting. If none is, the update has settled (taken over, or gone away) and reloading is safe
 * ('settled'). If one is still waiting, try once more, then re-check a final time. Bounded by
 * construction: at most two attempts and two short re-check pauses, after which the outcome is
 * 'gave-up' and the caller reloads anyway under the old worker, so the app always ends up locked.
 */
export async function activateForLock(
  deps: LockActivationDeps,
  recheckDelayMs: number = LOCK_RECHECK_DELAY_MS,
): Promise<LockActivationOutcome> {
  const first = await deps.attempt();
  if (first === 'activated') return 'activated';
  if (first === 'other-tabs-open') return 'other-tabs-open';
  await deps.delay(recheckDelayMs);
  if (!(await deps.stillWaiting())) return 'settled';
  const second = await deps.attempt();
  if (second === 'activated') return 'activated';
  if (second === 'other-tabs-open') return 'other-tabs-open';
  await deps.delay(recheckDelayMs);
  return (await deps.stillWaiting()) ? 'gave-up' : 'settled';
}

/**
 * When the app is already about to reload (e.g. locking), activates any waiting Service Worker
 * first if the page is visible and no other tab is open, so the reload lands on the new version
 * cleanly. Skips when hidden (e.g. iOS put-away auto-lock) so locking reloads immediately.
 * Returns true when the reload is known to be safe from a mixed build (the update took control,
 * or no update is still pending); false when another tab is open or the bounded wait gave up, in
 * which case the caller reloads anyway — locking must never hang on an update.
 */
export async function activateWaitingUpdateBeforeReload(timeoutMs = 500): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.waiting) return false;
    const outcome = await activateForLock({
      attempt: () => activateWaitingUpdateResult(navigator.serviceWorker, registration.waiting!, {
        onlyIfAlone: true,
        timeoutMs,
        confirmedTimeoutMs: LOCK_CONFIRMED_ACTIVATION_TIMEOUT_MS,
      }),
      stillWaiting: async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
      delay: (ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
    });
    return outcome === 'activated' || outcome === 'settled';
  } catch {
    return false;
  }
}

export interface ApplyUpdateState {
  /** The page is on screen. */
  visible: boolean;
  passcodeOn: boolean;
  /** The passcode has been entered (always true without a passcode). */
  unlocked: boolean;
  /** The app has just come back to the foreground. */
  returningToForeground: boolean;
  /** The app reloaded itself for an update in the last minute (so a worker that won't activate can't loop). */
  recentlyAutoUpdated: boolean;
}

/**
 * Whether a waiting update can be put in use right away without costing the user anything:
 * while the lock screen is showing (nothing is open yet), or without a passcode when the app comes
 * back to the foreground (a reload keeps unsaved Data Entry work and there is nothing to unlock).
 * In the middle of an unlocked session it waits for the user to choose Reload.
 */
export function shouldApplyUpdateNow(state: ApplyUpdateState): boolean {
  if (!state.visible || state.recentlyAutoUpdated) return false;
  if (state.passcodeOn) return !state.unlocked;
  return state.returningToForeground;
}
