import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SW_SKIP_WAITING_IF_ALONE_MESSAGE,
  SW_SKIP_WAITING_MESSAGE,
  activateWaitingUpdate,
  activateWaitingUpdateBeforeReload,
  watchForWaitingUpdate,
  type SwContainerLike,
  type SwLike,
  type SwRegistrationLike,
} from '../service-worker-update';

// The service worker template (scripts/sw-template.js) and client update coordinator
// (src/lib/service-worker-update.ts): installing a new deploy while an older version of the app is
// open must leave the active version's pages, RSC payloads (/*/index.txt) and static chunks
// untouched so client-side tab switches never hit a Next.js buildId mismatch and force a full-page
// reload (which clears the in-memory passcode key and re-locks the app).

const ORIGIN = 'https://ascended.example';
const SW_TEMPLATE = readFileSync(path.resolve(__dirname, '../../../scripts/sw-template.js'), 'utf8');

/** Minimal in-memory CacheStorage shared between two SW instances in a test. */
function createMockCacheStorage(networkFetch: (input: RequestInfo | URL) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();

  const normalizeKey = (req: RequestInfo | URL, ignoreSearch = false) => {
    const rawUrl = typeof req === 'string' ? req : req instanceof URL ? req.href : req.url;
    const parsed = new URL(rawUrl, ORIGIN);
    return ignoreSearch ? `${parsed.origin}${parsed.pathname}` : parsed.href;
  };

  const makeCache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name)!;
    return {
      async match(req: RequestInfo | URL, options?: { ignoreSearch?: boolean }) {
        const target = normalizeKey(req, !!options?.ignoreSearch);
        for (const [k, res] of map.entries()) {
          const cmp = options?.ignoreSearch ? normalizeKey(k, true) : k;
          if (cmp === target) return res.clone();
        }
        return undefined;
      },
      async put(req: RequestInfo | URL, response: Response) {
        map.set(normalizeKey(req, false), response.clone());
      },
      async addAll(requests: (RequestInfo | URL)[]) {
        for (const req of requests) {
          const res = await networkFetch(req);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          map.set(normalizeKey(req, false), res.clone());
        }
      },
      async keys() {
        return [...map.keys()].map((u) => new Request(u));
      },
      async delete(req: RequestInfo | URL) {
        return map.delete(normalizeKey(req, false));
      },
    };
  };

  return {
    stores,
    caches: {
      async open(name: string) { return makeCache(name); },
      async keys() { return [...stores.keys()]; },
      async delete(name: string) { return stores.delete(name); },
      async match(req: RequestInfo | URL, options?: { ignoreSearch?: boolean }) {
        for (const name of stores.keys()) {
          const hit = await makeCache(name).match(req, options);
          if (hit) return hit;
        }
        return undefined;
      },
    },
  };
}

/** Instantiates scripts/sw-template.js with the given VERSION and PRECACHE_URLS in a VM sandbox. */
function loadServiceWorker(opts: {
  version: string;
  precacheUrls: string[];
  caches: ReturnType<typeof createMockCacheStorage>['caches'];
  fetchImpl: (input: RequestInfo | URL) => Promise<Response>;
  clientCount?: number;
}) {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  let clientCount = opts.clientCount ?? 1;

  const swGlobal: Record<string, unknown> = {
    location: new URL(`${ORIGIN}/sw.js`),
    caches: opts.caches,
    URL,
    Request: class SwRequest extends Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        const resolved = typeof input === 'string' && input.startsWith('/') ? `${ORIGIN}${input}` : input;
        super(resolved, init);
      }
    },
    Response,
    fetch: opts.fetchImpl,
    addEventListener(type: string, fn: (event: unknown) => void) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
    skipWaiting: async () => { skipWaitingCalls++; },
    clients: {
      claim: async () => { claimCalls++; },
      matchAll: async () => Array.from({ length: clientCount }, (_, i) => ({ id: `c${i}` })),
    },
  };
  swGlobal.self = swGlobal;

  const source = SW_TEMPLATE
    .replace('__VERSION__', JSON.stringify(opts.version))
    .replace('__PRECACHE_URLS__', JSON.stringify(opts.precacheUrls));

  vm.runInNewContext(source, swGlobal);

  const dispatchExtendable = async (type: string, extra: Record<string, unknown> = {}) => {
    const waited: Promise<unknown>[] = [];
    for (const fn of listeners.get(type) ?? []) {
      fn({ ...extra, waitUntil: (p: Promise<unknown>) => waited.push(p) });
    }
    await Promise.all(waited);
  };

  const dispatchFetch = async (urlPath: string, mode: 'navigate' | 'cors' = 'cors') => {
    let responsePromise: Promise<Response> | undefined;
    const req = new Request(`${ORIGIN}${urlPath}`);
    Object.defineProperty(req, 'mode', { value: mode });
    for (const fn of listeners.get('fetch') ?? []) {
      fn({ request: req, respondWith: (p: Promise<Response>) => { responsePromise = p; } });
    }
    if (!responsePromise) throw new Error(`fetch not handled for ${urlPath}`);
    return responsePromise;
  };

  return {
    install: () => dispatchExtendable('install'),
    activate: () => dispatchExtendable('activate'),
    fetch: dispatchFetch,
    message: (data: unknown, ports: { postMessage: (msg: unknown) => void }[] = []) =>
      dispatchExtendable('message', { data, ports }),
    setClientCount: (n: number) => { clientCount = n; },
    get skipWaitingCalls() { return skipWaitingCalls; },
    get claimCalls() { return claimCalls; },
  };
}

describe('service worker update isolation (scripts/sw-template.js)', () => {
  it('keeps the active build RSC payloads and chunks intact when a newer build installs in the background', async () => {
    const requestedCacheModes = new Map<string, string | undefined>();
    let deployedBuild: 'A' | 'B' = 'A';

    const serverResponses = (): Record<string, string> => (deployedBuild === 'A'
      ? {
          '/': '<html>root-A</html>',
          '/settings/': '<html>settings-A</html>',
          '/manage-sessions/': '<html>sessions-A</html>',
          '/manage-sessions/index.txt': '0:{"b":"BUILD_A","c":["","manage-sessions",""]}',
          '/_next/static/chunks/shared.js': 'shared-chunk',
          '/_next/static/chunks/sessions-A.js': 'sessions-chunk-A',
        }
      : {
          '/': '<html>root-B</html>',
          '/settings/': '<html>settings-B</html>',
          '/manage-sessions/': '<html>sessions-B</html>',
          '/manage-sessions/index.txt': '0:{"b":"BUILD_B","c":["","manage-sessions",""]}',
          '/_next/static/chunks/shared.js': 'shared-chunk',
          '/_next/static/chunks/sessions-B.js': 'sessions-chunk-B',
        });

    const networkFetch = async (input: RequestInfo | URL) => {
      const req = typeof input === 'string'
        ? new Request(input.startsWith('/') ? `${ORIGIN}${input}` : input)
        : input instanceof URL
          ? new Request(input.href)
          : input;
      const pathname = new URL(req.url).pathname;
      requestedCacheModes.set(pathname, req.cache);
      const body = serverResponses()[pathname];
      if (body === undefined) return new Response('Not Found', { status: 404 });
      const contentType = pathname.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8';
      return new Response(body, { status: 200, headers: { 'content-type': contentType } });
    };

    const { caches, stores } = createMockCacheStorage(networkFetch);

    // 1. Build A installs and activates on first visit.
    const swA = loadServiceWorker({
      version: 'verA',
      precacheUrls: [
        '/', '/settings/', '/manage-sessions/', '/manage-sessions/index.txt',
        '/_next/static/chunks/shared.js', '/_next/static/chunks/sessions-A.js',
      ],
      caches,
      fetchImpl: networkFetch,
    });
    await swA.install();
    await swA.activate();

    // 2. Build B is deployed and installs while the user has Build A open (e.g. on the lock screen or Settings).
    deployedBuild = 'B';
    requestedCacheModes.clear();
    const swB = loadServiceWorker({
      version: 'verB',
      precacheUrls: [
        '/', '/settings/', '/manage-sessions/', '/manage-sessions/index.txt',
        '/_next/static/chunks/shared.js', '/_next/static/chunks/sessions-B.js',
      ],
      caches,
      fetchImpl: networkFetch,
    });
    await swB.install();

    // Build B must wait instead of hijacking the running tab.
    expect(swB.skipWaitingCalls).toBe(0);
    // Unhashed pages and RSC files are fetched with cache: 'reload' so HTTP cache can't mix builds.
    expect(requestedCacheModes.get('/manage-sessions/index.txt')).toBe('reload');
    expect(requestedCacheModes.get('/settings/')).toBe('reload');
    // Both caches exist until Build B actually activates; Build A's chunk is still cached.
    expect(stores.has('ascended-pages-verA')).toBe(true);
    expect(stores.has('ascended-pages-verB')).toBe(true);
    expect(stores.get('ascended-static')!.has(`${ORIGIN}/_next/static/chunks/sessions-A.js`)).toBe(true);

    // 3. The user unlocks Build A on Settings and switches to the Sessions tab:
    // Build A's SW must serve Build A's RSC payload (matching BUILD_A) and Build A's chunk — never BUILD_B.
    const rscRes = await swA.fetch('/manage-sessions/index.txt?_rsc=xyz123', 'cors');
    expect(await rscRes.text()).toContain('"BUILD_A"');
    const chunkRes = await swA.fetch('/_next/static/chunks/sessions-A.js', 'cors');
    expect(await chunkRes.text()).toBe('sessions-chunk-A');
    const navRes = await swA.fetch('/manage-sessions', 'navigate');
    expect(await navRes.text()).toBe('<html>sessions-A</html>');

    // 4. Even if cache iteration order puts verB before verA, swA still reads only ascended-pages-verA.
    const verAData = stores.get('ascended-pages-verA')!;
    stores.delete('ascended-pages-verA');
    stores.set('ascended-pages-verA', verAData);
    const rscAfterReorder = await swA.fetch('/manage-sessions/index.txt?_rsc=999', 'cors');
    expect(await rscAfterReorder.text()).toContain('"BUILD_A"');

    // 5. Explicit SKIP_WAITING activates Build B and cleans up verA pages and obsolete verA chunks.
    await swB.message({ type: SW_SKIP_WAITING_MESSAGE });
    expect(swB.skipWaitingCalls).toBe(1);
    await swB.activate();
    expect(swB.claimCalls).toBe(1);
    expect(stores.has('ascended-pages-verA')).toBe(false);
    expect(stores.has('ascended-pages-verB')).toBe(true);
    expect(stores.get('ascended-static')!.has(`${ORIGIN}/_next/static/chunks/sessions-A.js`)).toBe(false);
    expect(stores.get('ascended-static')!.has(`${ORIGIN}/_next/static/chunks/sessions-B.js`)).toBe(true);
    expect(stores.get('ascended-static')!.has(`${ORIGIN}/_next/static/chunks/shared.js`)).toBe(true);
  });

  it('activates on SKIP_WAITING_IF_ALONE only when no other tab is open', async () => {
    const networkFetch = async () => new Response('ok', { status: 200 });
    const { caches } = createMockCacheStorage(networkFetch);
    const sw = loadServiceWorker({
      version: 'verB',
      precacheUrls: ['/'],
      caches,
      fetchImpl: networkFetch,
      clientCount: 2,
    });
    await sw.install();

    const replies: unknown[] = [];
    await sw.message({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE }, [{ postMessage: (m) => replies.push(m) }]);
    expect(sw.skipWaitingCalls).toBe(0);
    expect(replies).toEqual([{ activated: false }]);

    sw.setClientCount(1);
    await sw.message({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE }, [{ postMessage: (m) => replies.push(m) }]);
    expect(sw.skipWaitingCalls).toBe(1);
    expect(replies).toEqual([{ activated: false }, { activated: true }]);
  });
});

// ---- Client-side coordinator tests ----

function createMockEventTarget() {
  const map = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      let set = map.get(type);
      if (!set) { set = new Set(); map.set(type, set); }
      set.add(listener);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      map.get(type)?.delete(listener);
    },
    dispatch(type: string, event: Event = new Event(type)) {
      for (const listener of [...(map.get(type) ?? [])]) {
        if (typeof listener === 'function') listener(event);
        else listener.handleEvent(event);
      }
    },
    listenerCount(type: string) {
      return map.get(type)?.size ?? 0;
    },
  };
}

function createMockWorker(initialState = 'installing'): SwLike & {
  setState: (s: string) => void;
  messages: { data: unknown; transfer?: Transferable[] }[];
  listenerCount: (type: string) => number;
} {
  const target = createMockEventTarget();
  const messages: { data: unknown; transfer?: Transferable[] }[] = [];
  const worker = {
    state: initialState,
    messages,
    postMessage(data: unknown, transfer?: Transferable[]) {
      messages.push({ data, transfer });
    },
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    setState(s: string) {
      worker.state = s;
      target.dispatch('statechange');
    },
    listenerCount: target.listenerCount,
  };
  return worker;
}

function createMockContainer(controller: SwLike | null = null): SwContainerLike & {
  dispatchControllerChange: () => void;
  listenerCount: (type: string) => number;
} {
  const target = createMockEventTarget();
  return {
    controller,
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatchControllerChange() { target.dispatch('controllerchange'); },
    listenerCount: target.listenerCount,
  };
}

function createMockRegistration(init?: { waiting?: SwLike | null; installing?: SwLike | null }): SwRegistrationLike & {
  dispatchUpdateFound: () => void;
  listenerCount: (type: string) => number;
} {
  const target = createMockEventTarget();
  return {
    waiting: init?.waiting ?? null,
    installing: init?.installing ?? null,
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatchUpdateFound() { target.dispatch('updatefound'); },
    listenerCount: target.listenerCount,
  };
}

describe('watchForWaitingUpdate', () => {
  it('notifies immediately when a worker is already waiting (e.g. installed while on the lock screen)', () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);
    const reg = createMockRegistration({ waiting });
    const onReady = vi.fn();

    const stop = watchForWaitingUpdate(container, reg, onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(waiting);
    stop();
  });

  it('does not notify on the very first install when there is no controller yet', () => {
    const installing = createMockWorker('installing');
    const container = createMockContainer(null);
    const reg = createMockRegistration({ installing });
    const onReady = vi.fn();

    const stop = watchForWaitingUpdate(container, reg, onReady);
    installing.setState('installed');
    expect(onReady).not.toHaveBeenCalled();
    stop();
  });

  it('notifies once when an update found later finishes installing, and cleans up listeners', () => {
    const active = createMockWorker('activated');
    const container = createMockContainer(active);
    const reg = createMockRegistration();
    const onReady = vi.fn();

    const stop = watchForWaitingUpdate(container, reg, onReady);
    const next = createMockWorker('installing');
    reg.installing = next;
    reg.dispatchUpdateFound();
    expect(onReady).not.toHaveBeenCalled();

    next.setState('installed');
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(next);

    // Re-observing the same waiting worker must not duplicate the notice.
    reg.installing = next;
    reg.dispatchUpdateFound();
    expect(onReady).toHaveBeenCalledTimes(1);

    stop();
    expect(reg.listenerCount('updatefound')).toBe(0);
    expect(next.listenerCount('statechange')).toBe(0);
  });
});

describe('activateWaitingUpdate and activateWaitingUpdateBeforeReload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends SKIP_WAITING and resolves true once controllerchange fires', async () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);

    const promise = activateWaitingUpdate(container, waiting, { timeoutMs: 500 });
    expect(waiting.messages).toHaveLength(1);
    expect(waiting.messages[0].data).toEqual({ type: SW_SKIP_WAITING_MESSAGE });

    container.dispatchControllerChange();
    expect(await promise).toBe(true);
    expect(container.listenerCount('controllerchange')).toBe(0);
    expect(waiting.listenerCount('statechange')).toBe(0);
  });

  it('resolves false immediately when SKIP_WAITING_IF_ALONE reports another tab is open', async () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);

    const started = Date.now();
    const promise = activateWaitingUpdate(container, waiting, { onlyIfAlone: true, timeoutMs: 2000 });
    expect(waiting.messages).toHaveLength(1);
    expect(waiting.messages[0].data).toEqual({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE });
    const port = waiting.messages[0].transfer?.[0] as MessagePort;
    port.postMessage({ activated: false });

    expect(await promise).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('skips waiting-worker activation in activateWaitingUpdateBeforeReload when the page is hidden', async () => {
    const getRegistration = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
    vi.stubGlobal('document', { visibilityState: 'hidden' });

    expect(await activateWaitingUpdateBeforeReload()).toBe(false);
    expect(getRegistration).not.toHaveBeenCalled();
  });

  it('resolves false immediately if the waiting worker becomes redundant', async () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);

    const started = Date.now();
    const promise = activateWaitingUpdate(container, waiting, { timeoutMs: 2000 });
    waiting.setState('redundant');
    expect(await promise).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('activates a waiting worker with SKIP_WAITING_IF_ALONE when visible', async () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);
    const reg = createMockRegistration({ waiting });
    container.getRegistration = async () => reg;

    vi.stubGlobal('navigator', { serviceWorker: container });
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const promise = activateWaitingUpdateBeforeReload(500);
    await new Promise((r) => setTimeout(r, 10));
    expect(waiting.messages[0].data).toEqual({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE });
    container.dispatchControllerChange();
    expect(await promise).toBe(true);
  });

  it('lockNow activates a waiting worker before reloading when visible', async () => {
    const active = createMockWorker('activated');
    const waiting = createMockWorker('installed');
    const container = createMockContainer(active);
    const reg = createMockRegistration({ waiting });
    container.getRegistration = async () => reg;
    const reload = vi.fn();

    vi.stubGlobal('navigator', { serviceWorker: container });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('window', { location: { reload } });

    vi.resetModules();
    const { lockNow } = await import('../secure-store');
    const locking = lockNow();
    await new Promise((r) => setTimeout(r, 10));
    expect(reload).not.toHaveBeenCalled();
    expect(waiting.messages[0].data).toEqual({ type: SW_SKIP_WAITING_IF_ALONE_MESSAGE });
    container.dispatchControllerChange();
    await locking;
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
