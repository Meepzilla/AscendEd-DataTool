// Adds a Content Security Policy to every exported page so the browser runs only the app's own scripts:
// script files from this site, plus the exact scripts written into each page (Next.js's page data and the
// display-size script), allowed by their SHA-256 hash. Any other script (injected into the page, or loaded from
// another site) is blocked. Runs after `next build` for the static export, before the service worker is
// generated (so its version reflects these pages).
//
// The hashes differ per page, so this is a <meta> tag in each page rather than a header (the header in
// public/_headers keeps the rules a <meta> tag can't set, such as frame-ancestors; the browser applies both).
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = 'out';

async function listHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(fullPath);
    return fullPath.endsWith('.html') ? [fullPath] : [];
  }));
  return files.flat();
}

// Inline scripts the browser runs: no src, and no type, or a JavaScript type (JSON data blocks don't run).
const INLINE_SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const runs = (attrs = '') => {
  if (/\ssrc\s*=/i.test(attrs)) return false;
  const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
  return !type || type === 'module' || type.includes('javascript');
};

let pages = 0;
for (const file of await listHtml(OUT_DIR)) {
  let html = await readFile(file, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    if (runs(attrs)) hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  const policy = ["script-src 'self'", ...hashes].join(' ');
  // First in <head>, so it applies to every script after it.
  const updated = html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}<meta http-equiv="Content-Security-Policy" content="${policy}"/>`);
  if (updated === html) throw new Error(`No <head> in ${file}`);
  await writeFile(file, updated);
  pages++;
}
console.log(`Added a script Content Security Policy to ${pages} pages`);
