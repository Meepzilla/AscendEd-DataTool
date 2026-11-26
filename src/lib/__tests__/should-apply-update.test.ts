import { describe, expect, it, vi } from 'vitest';
import { applyWaitingUpdate, reloadFromUpdateNotice, shouldApplyUpdateNow, type ApplyUpdateState } from '../service-worker-update';

const base: ApplyUpdateState = {
  visible: true,
  passcodeOn: true,
  unlocked: false,
  returningToForeground: false,
  recentlyAutoUpdated: false,
};

describe('shouldApplyUpdateNow', () => {
  it('applies while the lock screen is showing', () => {
    expect(shouldApplyUpdateNow(base)).toBe(true);
    expect(shouldApplyUpdateNow({ ...base, returningToForeground: true })).toBe(true);
  });

  it('waits in the middle of an unlocked session, even on returning to the app', () => {
    expect(shouldApplyUpdateNow({ ...base, unlocked: true })).toBe(false);
    expect(shouldApplyUpdateNow({ ...base, unlocked: true, returningToForeground: true })).toBe(false);
  });

  it('without a passcode, applies only when the app comes back to the foreground', () => {
    const open = { ...base, passcodeOn: false, unlocked: true };
    expect(shouldApplyUpdateNow(open)).toBe(false);
    expect(shouldApplyUpdateNow({ ...open, returningToForeground: true })).toBe(true);
  });

  it('never applies while hidden', () => {
    expect(shouldApplyUpdateNow({ ...base, visible: false })).toBe(false);
    expect(shouldApplyUpdateNow({ ...base, passcodeOn: false, unlocked: true, visible: false, returningToForeground: true })).toBe(false);
  });

  it('does not reload again within a minute of the last automatic update', () => {
    expect(shouldApplyUpdateNow({ ...base, recentlyAutoUpdated: true })).toBe(false);
  });
});

describe('applyWaitingUpdate', () => {
  // A fake waiting worker and container: the worker answers the alone check with `alone`, and takes control
  // (controllerchange) when it agrees to activate, unless `takesControl` is false.
  function setup({ alone = true, takesControl = true, waiting = true } = {}) {
    const listeners: Record<string, ((e?: any) => void)[]> = {};
    const container = {
      controller: {},
      addEventListener: (type: string, fn: any) => { (listeners[type] ??= []).push(fn); },
      removeEventListener: (type: string, fn: any) => { listeners[type] = (listeners[type] ?? []).filter(f => f !== fn); },
    };
    const posted: string[] = [];
    const worker = {
      state: 'installed',
      addEventListener: () => {},
      removeEventListener: () => {},
      postMessage: (message: { type: string }, transfer?: MessagePort[]) => {
        posted.push(message.type);
        const port = transfer?.[0];
        const activate = message.type === 'SKIP_WAITING' || alone;
        if (port) port.postMessage({ activated: activate });
        if (activate && takesControl) setTimeout(() => (listeners.controllerchange ?? []).forEach(fn => fn()), 5);
      },
    };
    const reload = vi.fn();
    const flush = vi.fn(async () => {});
    return { container, registration: { waiting: waiting ? worker : null }, reload, flush, posted };
  }

  it('reloads once the new version takes control when this is the only tab', async () => {
    const s = setup();
    await expect(applyWaitingUpdate({ ...s, onlyIfAlone: true } as any)).resolves.toBe('reloaded');
    expect(s.flush).toHaveBeenCalled();
    expect(s.reload).toHaveBeenCalledTimes(1);
    expect(s.posted).toEqual(['SKIP_WAITING_IF_ALONE']);
  });

  it('never takes over automatically while another tab is open', async () => {
    const s = setup({ alone: false });
    await expect(applyWaitingUpdate({ ...s, onlyIfAlone: true } as any)).resolves.toBe('other-tabs-open');
    expect(s.reload).not.toHaveBeenCalled();
  });

  it('does not reload (or loop) when the new version never takes control', async () => {
    vi.useFakeTimers();
    try {
      const s = setup({ takesControl: false });
      const pending = applyWaitingUpdate({ ...s, onlyIfAlone: true } as any);
      await vi.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toBe('failed');
      expect(s.reload).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates all tabs when asked, whatever happens', async () => {
    const s = setup({ alone: false });
    await expect(applyWaitingUpdate({ ...s, onlyIfAlone: false } as any)).resolves.toBe('reloaded');
    expect(s.posted).toEqual(['SKIP_WAITING']);
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it('just reloads when nothing is waiting', async () => {
    const s = setup({ waiting: false });
    await expect(applyWaitingUpdate({ ...s, onlyIfAlone: true } as any)).resolves.toBe('reloaded');
    expect(s.reload).toHaveBeenCalledTimes(1);
  });
});

describe('reloadFromUpdateNotice', () => {
  // The branching behind ServiceWorkerRegistration's Reload tap, including the E1 regression: a failed
  // alone attempt must be reported, never silently escalated to updating every open tab.
  function setup(result: 'reloaded' | 'other-tabs-open' | 'failed') {
    const applyUpdate = vi.fn(async (_onlyIfAlone: boolean) => result);
    const onOtherTabsOpen = vi.fn();
    const onFailed = vi.fn();
    return { applyUpdate, onOtherTabsOpen, onFailed };
  }

  it('does nothing more when this tab updated alone', async () => {
    const s = setup('reloaded');
    await reloadFromUpdateNotice(s);
    expect(s.applyUpdate).toHaveBeenCalledTimes(1);
    expect(s.applyUpdate).toHaveBeenCalledWith(true);
    expect(s.onOtherTabsOpen).not.toHaveBeenCalled();
    expect(s.onFailed).not.toHaveBeenCalled();
  });

  it('reports other tabs open instead of updating them', async () => {
    const s = setup('other-tabs-open');
    await reloadFromUpdateNotice(s);
    expect(s.applyUpdate).toHaveBeenCalledTimes(1);
    expect(s.onOtherTabsOpen).toHaveBeenCalledTimes(1);
    expect(s.onFailed).not.toHaveBeenCalled();
  });

  it('reports a failed attempt and never escalates to update-all on its own', async () => {
    const s = setup('failed');
    await reloadFromUpdateNotice(s);
    expect(s.applyUpdate).toHaveBeenCalledTimes(1);
    expect(s.applyUpdate).not.toHaveBeenCalledWith(false);
    expect(s.onFailed).toHaveBeenCalledTimes(1);
    expect(s.onOtherTabsOpen).not.toHaveBeenCalled();
  });
});

describe('activateWaitingUpdateResult', () => {
  it('waits longer once the worker has agreed to activate, so the lock path does not reload too early', async () => {
    const { activateWaitingUpdateResult } = await import('../service-worker-update');
    vi.useFakeTimers();
    try {
      const listeners: ((e?: any) => void)[] = [];
      const container = {
        controller: {},
        addEventListener: (_t: string, fn: any) => { listeners.push(fn); },
        removeEventListener: () => {},
      };
      const worker = {
        state: 'installed', addEventListener: () => {}, removeEventListener: () => {},
        postMessage: (_m: unknown, transfer?: MessagePort[]) => {
          transfer?.[0]?.postMessage({ activated: true });
          setTimeout(() => listeners.forEach(fn => fn()), 1200); // takes control after the 500 ms lock-path timeout
        },
      };
      const pending = activateWaitingUpdateResult(container as any, worker as any, { onlyIfAlone: true, timeoutMs: 500 });
      await vi.advanceTimersByTimeAsync(1500);
      await expect(pending).resolves.toBe('activated');
    } finally {
      vi.useRealTimers();
    }
  });

  it('extends the wait the same way on the update-all path once the worker confirms', async () => {
    const { activateWaitingUpdateResult } = await import('../service-worker-update');
    vi.useFakeTimers();
    try {
      const listeners: ((e?: any) => void)[] = [];
      const container = {
        controller: {},
        addEventListener: (_t: string, fn: any) => { listeners.push(fn); },
        removeEventListener: () => {},
      };
      const posted: string[] = [];
      const worker = {
        state: 'installed', addEventListener: () => {}, removeEventListener: () => {},
        postMessage: (message: { type: string }, transfer?: MessagePort[]) => {
          posted.push(message.type);
          transfer?.[0]?.postMessage({ activated: true });
          setTimeout(() => listeners.forEach(fn => fn()), 1200); // takes control after the 500 ms timeout
        },
      };
      const pending = activateWaitingUpdateResult(container as any, worker as any, { onlyIfAlone: false, timeoutMs: 500 });
      await vi.advanceTimersByTimeAsync(1500);
      await expect(pending).resolves.toBe('activated');
      expect(posted).toEqual(['SKIP_WAITING']);
    } finally {
      vi.useRealTimers();
    }
  });
});
