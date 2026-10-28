// Service worker for the static build. scripts/generate-service-worker.mjs fills in
// VERSION and PRECACHE_URLS and writes the result to out/sw.js.
//
// Every file of the app is stored on install, so the app works offline once it has loaded.
// A new deploy changes VERSION, which makes the browser install the new version in the background;
// it is used the next time the app is opened.

const VERSION = __VERSION__;
const PRECACHE_URLS = __PRECACHE_URLS__;

// Files under /_next/static/ have content hashes in their names and never change, so they share one
// cache across versions. A page still running the previous version can keep loading its chunks.
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
    await pagesCache.addAll(PRECACHE_URLS.filter((url) => !isStaticAsset(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('ascended-pages-') && key !== PAGES_CACHE) await caches.delete(key);
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
      const pathname = url.pathname.endsWith('/') || url.pathname.includes('.') ? url.pathname : `${url.pathname}/`;
      return (await caches.match(pathname, MATCH_OPTIONS))
        || fetch(request).catch(async () => (await caches.match('/', MATCH_OPTIONS)) || Response.error());
    }

    const cached = await caches.match(request, MATCH_OPTIONS);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && isStaticAsset(url.pathname)) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
