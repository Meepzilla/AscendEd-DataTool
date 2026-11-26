// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Component coverage for ServiceWorkerRegistration (review finding B3): the branching that decides
// between applying a waiting update at once, showing the "App updated" notice, and what a tap on
// Reload does. The service-worker lib functions run for real against a fake registration; only the
// toast surface and the secure store's passcode state are mocked.

const h = vi.hoisted(() => ({
  passcodeOn: true,
  unlocked: false,
  toasts: [] as { title?: string; open?: boolean }[],
  toastCalls: [] as { title?: string; action?: React.ReactElement }[],
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toasts: h.toasts,
    toast: (props: { title?: string; action?: React.ReactElement }) => {
      h.toastCalls.push(props);
      return { id: String(h.toastCalls.length), dismiss: () => {}, update: () => {} };
    },
    dismiss: () => {},
  }),
}));

vi.mock('@/lib/secure-store', () => ({
  flushWrites: vi.fn(async () => {}),
  isPasscodeEnabled: () => h.passcodeOn,
  isUnlocked: () => h.unlocked,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import ServiceWorkerRegistration from '../ServiceWorkerRegistration';

const UPDATE_TITLE = 'App updated';
const OTHER_TABS_TITLE = 'AscendEd is open in another tab';
const UPDATE_FAILED_TITLE = 'Update could not start';
const LAST_AUTO_UPDATE_KEY = 'ascended_last_auto_update';

interface WorkerOptions { alone?: boolean; takesControl?: boolean; redundant?: boolean }

function fakeWorker({ alone = true, takesControl = true, redundant = false }: WorkerOptions, posted: string[], fireControllerChange: () => void) {
  const stateListeners: (() => void)[] = [];
  const worker: Record<string, unknown> = {
    state: 'installed',
    addEventListener: (type: string, fn: () => void) => { if (type === 'statechange') stateListeners.push(fn); },
    removeEventListener: () => {},
    postMessage: (message: { type: string }, transfer?: MessagePort[]) => {
      posted.push(message.type);
      if (redundant) {
        worker.state = 'redundant';
        queueMicrotask(() => stateListeners.forEach(fn => fn()));
        return;
      }
      const activate = message.type === 'SKIP_WAITING' || alone;
      transfer?.[0]?.postMessage({ activated: activate });
      if (activate && takesControl) setTimeout(fireControllerChange, 5);
    },
  };
  return worker;
}

function setup(workerOptions: WorkerOptions = {}) {
  const posted: string[] = [];
  const controllerListeners: (() => void)[] = [];
  const fireControllerChange = () => controllerListeners.forEach(fn => fn());
  const worker = fakeWorker(workerOptions, posted, fireControllerChange);
  const registration: Record<string, unknown> = {
    waiting: worker,
    installing: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    update: vi.fn(async () => {}),
  };
  const container = {
    controller: { state: 'activated' },
    addEventListener: (type: string, fn: () => void) => { if (type === 'controllerchange') controllerListeners.push(fn); },
    removeEventListener: (type: string, fn: () => void) => {
      const i = controllerListeners.indexOf(fn);
      if (i >= 0) controllerListeners.splice(i, 1);
    },
    getRegistration: async () => registration,
    register: async () => registration,
  };
  Object.defineProperty(window.navigator, 'serviceWorker', { value: container, configurable: true });
  Object.defineProperty(window.navigator, 'storage', { value: { persist: async () => true }, configurable: true });
  return { posted, registration };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const reloadSpy = vi.fn();

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(React.createElement(ServiceWorkerRegistration)); });
  // Let registration, the waiting watch and any activation timers settle.
  await act(async () => { await new Promise(r => setTimeout(r, 30)); });
}

async function flush(ms = 30) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}

function toastTitles() {
  return h.toastCalls.map(c => c.title);
}

async function tapReload() {
  const notice = h.toastCalls.find(c => c.title === UPDATE_TITLE);
  expect(notice?.action).toBeTruthy();
  await act(async () => { (notice!.action!.props as { onClick: () => void }).onClick(); });
  await flush(50);
}

beforeEach(() => {
  h.passcodeOn = true;
  h.unlocked = false;
  h.toasts = [];
  h.toastCalls = [];
  reloadSpy.mockClear();
  process.env.NEXT_PUBLIC_STATIC_EXPORT = 'true';
  window.sessionStorage.clear();
  // jsdom's Location.reload cannot be redefined; swap the whole location for a stub.
  Object.defineProperty(window, 'location', { value: { href: 'http://localhost/', reload: reloadSpy }, configurable: true });
});

afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = null;
  host?.remove();
  host = null;
});

describe('ServiceWorkerRegistration', () => {
  it('applies a waiting update at once on the lock screen when this is the only tab', async () => {
    const { posted } = setup();
    await render();
    expect(posted).toEqual(['SKIP_WAITING_IF_ALONE']);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(toastTitles()).not.toContain(UPDATE_TITLE);
  });

  it('shows the notice mid-session, and Reload with another tab open explains instead of updating it', async () => {
    h.unlocked = true; // mid-session: no automatic apply
    const { posted } = setup({ alone: false });
    await render();
    expect(toastTitles()).toEqual([UPDATE_TITLE]);
    expect(posted).toEqual([]);
    await tapReload();
    expect(posted).toEqual(['SKIP_WAITING_IF_ALONE']); // never the unconditional update-all message
    expect(toastTitles()).toEqual([UPDATE_TITLE, OTHER_TABS_TITLE]);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does not auto-apply within a minute of the last automatic update (reload-loop guard)', async () => {
    window.sessionStorage.setItem(LAST_AUTO_UPDATE_KEY, String(Date.now()));
    const { posted } = setup();
    await render(); // on the lock screen, but the guard stamp is fresh
    expect(posted).toEqual([]);
    expect(toastTitles()).toEqual([UPDATE_TITLE]);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('reports a failed Reload attempt and never escalates to updating all tabs (E1)', async () => {
    h.unlocked = true;
    const { posted } = setup({ redundant: true });
    await render();
    expect(toastTitles()).toEqual([UPDATE_TITLE]);
    await tapReload();
    expect(posted).toEqual(['SKIP_WAITING_IF_ALONE']);
    expect(toastTitles()).toEqual([UPDATE_TITLE, UPDATE_FAILED_TITLE]);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('defers the notice while another notice is showing, then offers it when that notice closes (B4)', async () => {
    h.unlocked = true;
    h.toasts = [{ title: 'Could not save', open: true }];
    setup();
    await render();
    expect(toastTitles()).toEqual([]); // not clobbered on initial discovery either
    h.toasts = [];
    await act(async () => { root!.render(React.createElement(ServiceWorkerRegistration)); });
    await flush();
    expect(toastTitles()).toEqual([UPDATE_TITLE]);
  });
});
