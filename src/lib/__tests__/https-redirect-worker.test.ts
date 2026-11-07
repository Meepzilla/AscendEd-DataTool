import { describe, expect, it } from 'vitest';
import worker from '../../../worker/index.js';

// The Cloudflare Worker in front of the static app (worker/index.js): plain HTTP is redirected to HTTPS, HTTPS
// requests are handed to the static files unchanged.
const assets = { fetch: async (request: Request) => new Response(`asset ${new URL(request.url).pathname}`) };

describe('HTTPS redirect worker', () => {
  it('redirects an HTTP request to the same address over HTTPS, keeping the path and query', async () => {
    const res = await worker.fetch(new Request('http://ascended.example/dashboard/?studentId=s1'), { ASSETS: assets });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://ascended.example/dashboard/?studentId=s1');
  });

  it('redirects requests for files too, not only pages', async () => {
    const res = await worker.fetch(new Request('http://ascended.example/_next/static/chunks/app.js'), { ASSETS: assets });
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://ascended.example/_next/static/chunks/app.js');
  });

  it('serves HTTPS requests from the static files', async () => {
    const res = await worker.fetch(new Request('https://ascended.example/help/'), { ASSETS: assets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('asset /help/');
  });
});
