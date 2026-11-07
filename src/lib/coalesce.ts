// Runs an async task once after a burst of triggers ends (trailing edge): each trigger restarts the wait, and a
// trigger that arrives while the task is running runs it once more afterwards. Nothing triggered is dropped:
// the last run always starts after the last trigger. Used to reload data once after another tab's burst of saves
// (Save All saves each student in turn) instead of only on the first message, which missed the rest.

export interface Coalesced {
  trigger: () => void;
  cancel: () => void;
}

export function coalesce(run: () => Promise<void>, waitMs: number): Coalesced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let again = false;
  let cancelled = false;

  const start = async () => {
    timer = null;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      await run();
    } catch {
      // The task reports its own errors; a failure must not stop later triggers.
    } finally {
      running = false;
      if (again && !cancelled) {
        again = false;
        trigger();
      }
    }
  };

  const trigger = () => {
    if (cancelled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void start(); }, waitMs);
  };

  const cancel = () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { trigger, cancel };
}
