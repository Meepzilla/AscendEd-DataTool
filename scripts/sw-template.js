// Service worker for the static build. scripts/generate-service-worker.mjs fills in
// VERSION and PRECACHE_URLS and writes the result to out/sw.js.
//
// Every file of the app is stored on install, so the app works offline once it has loaded.
// A new deploy changes VERSION, which makes the browser install the new version in the background;
// it waits until the app is closed and reopened, locked (when no other tab is open), or reloaded
// from the "App updated" notice. Skipping waiting automatically would replace the running tab's
// RSC payloads (/*/index.txt) with a newer buildId, causing Next.js to fall back to a full-page
// reload on the next tab switch and wipe the in-memory passcode key.

const VERSION = __VERSION__;
const PRECACHE_URLS = __PRECACHE_URLS__;

// Files under /_next/static/ have content hashes in their names and never change, so they share one
// cache across versions. A page still running the previous version can keep loading its chunks until
// the new version activates.
const STATIC_CACHE = 'ascended-static';
const PAGES_CACHE = `ascended-pages-${VERSION}`;
const MATCH_OPTIONS = { ignoreSearch: true, ignoreVary: true };

const isStaticAsset = (pathname) => pathname.startsWith('/_next/static/');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    const pagesCache = await caches.open(PAGES_CACHE);
    const staticUrls = [];
    for (const url of PRECACHE_URLS.filter(isStaticAsset)) {
      if (!(await staticCache.match(url))) staticUrls.push(url);
    }
    await staticCache.addAll(staticUrls);
    // Bypass the browser HTTP cache for unhashed pages and RSC payloads so a new version's cache
    // never mixes files from an earlier deploy.
    const pageRequests = PRECACHE_URLS
      .filter((url) => !isStaticAsset(url))
      .map((url) => new Request(url, { cache: 'reload' }));
    await pagesCache.addAll(pageRequests);
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  } else if (type === 'SKIP_WAITING_IF_ALONE') {
    const port = event.ports && event.ports[0];
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clients.length <= 1) {
        await self.skipWaiting();
        if (port) port.postMessage({ activated: true });
      } else if (port) {
        port.postMessage({ activated: false });
      }
    })());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ascended-pages-') && key !== PAGES_CACHE) await caches.delete(key);
    }
    // Chunks from earlier versions that this one doesn't use, so storage doesn't grow with every deploy.
    const current = new Set(PRECACHE_URLS.filter(isStaticAsset));
    const staticCache = await caches.open(STATIC_CACHE);
    for (const request of await staticCache.keys()) {
      if (!current.has(new URL(request.url).pathname)) await staticCache.delete(request);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    if (request.mode === 'navigate') {
      // Pages are stored as /route/ (trailingSlash export); fall back to the start page.
      // Read only from this version's PAGES_CACHE so a waiting update's cache never mixes in.
      const pagesCache = await caches.open(PAGES_CACHE);
      const pathname = url.pathname.endsWith('/') || url.pathname.includes('.') ? url.pathname : `${url.pathname}/`;
      return (await pagesCache.match(pathname, MATCH_OPTIONS))
        || fetch(request).catch(async () => (await pagesCache.match('/', MATCH_OPTIONS)) || Response.error());
    }

    if (isStaticAsset(url.pathname)) {
      const staticCache = await caches.open(STATIC_CACHE);
      const cached = await staticCache.match(request, MATCH_OPTIONS);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) staticCache.put(request, response.clone());
      return response;
    }

    // Non-static assets (including Next.js RSC payloads /*/index.txt) come only from this build's
    // PAGES_CACHE so client-side tab switches always match the running page's buildId.
    const pagesCache = await caches.open(PAGES_CACHE);
    const cached = await pagesCache.match(request, MATCH_OPTIONS);
    if (cached) return cached;
    return fetch(request);
  })());
});
