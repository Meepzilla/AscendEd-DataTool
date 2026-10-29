// Writes out/sw.js for the static build: lists every exported file for the service worker to store,
// and derives a version from their contents so each deploy with changes gets a new service worker.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = 'out';

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return files.flat();
}

const files = (await listFiles(OUT_DIR))
  .map((file) => path.relative(OUT_DIR, file).split(path.sep).join('/'))
  // The host's settings files (Cloudflare's _headers and _redirects) are not served to visitors.
  .filter((file) => !['sw.js', '_headers', '_redirects'].includes(file))
  .sort();

const hash = createHash('sha256');
const urls = [];
for (const file of files) {
  hash.update(file).update(await readFile(path.join(OUT_DIR, file)));
  // Pages are requested as /route/, not /route/index.html.
  urls.push('/' + file.replace(/(^|\/)index\.html$/, '$1'));
}

const version = hash.digest('hex').slice(0, 12);
const template = await readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
const sw = template
  .replace('__VERSION__', JSON.stringify(version))
  .replace('__PRECACHE_URLS__', JSON.stringify(urls, null, 2));
await writeFile(path.join(OUT_DIR, 'sw.js'), sw);
console.log(`Wrote ${OUT_DIR}/sw.js (version ${version}, ${urls.length} files)`);
