// Cloudflare Worker in front of the static app: sends any plain-HTTP request to the same address over HTTPS
// (301), so the app and its data never load over an unencrypted connection. Everything else is served from the
// static build unchanged. With "run_worker_first" in wrangler.jsonc the Worker sees every request, including ones
// for files that exist; without it, Cloudflare would serve those over HTTP before the Worker ran.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
          // Browsers remember to use HTTPS from the first secure response (HSTS in public/_headers); this covers
          // the very first visit.
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
