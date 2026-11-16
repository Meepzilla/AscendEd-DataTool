// Fails the build if the static export has lost any of its security controls, so a change that weakens them
// can't be merged unnoticed (it runs last in build:static, which CI runs on every pull request). It checks:
// - every page has a Content Security Policy that loads only the app's own files (default-src 'self', no plugins,
//   forms sent only to this site) and allows only the app's own scripts ('self' plus the hash
//   of each inline script on that page), with no 'unsafe-inline' or 'unsafe-eval', and that every inline script
//   on the page is covered by one of its hashes;
// - the hosting headers (public/_headers for Cloudflare, netlify.toml for Netlify) still send the same set of
//   security headers for every path;
// - the Cloudflare Worker that redirects plain HTTP to HTTPS still runs first (wrangler.jsonc);
// - the Android app still keeps student data out of Android's backup and phone-to-phone transfer.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
const problems = [];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

// 1. The Content Security Policy on every page: these directives exactly, and a script-src checked below.
const PAGE_POLICY = {
  'default-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob:",
  'font-src': "'self' data:",
  'connect-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
};
let pages = 0;
for (const path of files(OUT)) {
  if (!path.endsWith('.html')) continue;
  pages++;
  const html = readFileSync(path, 'utf8');
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
  if (!meta) { problems.push(`${path}: no Content-Security-Policy meta tag`); continue; }
  const policy = meta[1];
  const directives = new Map(policy.split(';').map(d => d.trim().split(/\s+/)).filter(d => d[0]).map(([name, ...values]) => [name, values]));
  for (const [name, expected] of Object.entries(PAGE_POLICY)) {
    const values = directives.get(name);
    if (!values) problems.push(`${path}: the policy has no ${name}`);
    else if (values.join(' ') !== expected) problems.push(`${path}: ${name} is "${values.join(' ')}", expected "${expected}"`);
  }
  const scriptSrc = policy.split(';').map(d => d.trim()).find(d => d.startsWith('script-src'));
  if (!scriptSrc) { problems.push(`${path}: the policy has no script-src`); continue; }
  const sources = scriptSrc.split(/\s+/).slice(1);
  for (const source of sources) {
    if (source !== "'self'" && !/^'sha256-[A-Za-z0-9+/=]+'$/.test(source)) problems.push(`${path}: script-src allows ${source}`);
  }
  const hashes = new Set(sources.filter(s => s.startsWith("'sha256-")).map(s => s.slice(8, -1)));
  for (const [, attrs, body] of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs ?? '') || body === '') continue;
    if (/\btype="application\/(?:ld\+)?json"/.test(attrs ?? '')) continue;
    const hash = createHash('sha256').update(body, 'utf8').digest('base64');
    if (!hashes.has(hash)) problems.push(`${path}: an inline script isn't covered by the policy (sha256-${hash})`);
  }
}
if (pages === 0) problems.push(`no pages found in ${OUT}/`);

// 2. Hosting security headers, for every path ("/*"), on both hosts.
const REQUIRED = {
  'Content-Security-Policy': ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "connect-src 'self'"],
  'X-Frame-Options': ['DENY'],
  'X-Content-Type-Options': ['nosniff'],
  'Referrer-Policy': ['no-referrer'],
  'Strict-Transport-Security': ['max-age=31536000'],
  'Permissions-Policy': ['camera=()', 'microphone=()', 'geolocation=()'],
  'X-Robots-Tag': ['noindex'],
};
function checkHeaders(label, headers) {
  for (const [name, parts] of Object.entries(REQUIRED)) {
    const value = headers.get(name.toLowerCase());
    if (!value) { problems.push(`${label}: no ${name} header for every path`); continue; }
    for (const part of parts) if (!value.includes(part)) problems.push(`${label}: ${name} is missing "${part}"`);
  }
}
// public/_headers: the block under a line that is exactly "/*", "Name: value" lines indented below it.
{
  const headers = new Map();
  let inAll = false;
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    if (/^\S/.test(line)) { inAll = line.trim() === '/*'; continue; }
    const m = inAll && line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (m) headers.set(m[1].toLowerCase(), m[2]);
  }
  checkHeaders('public/_headers', headers);
}
// netlify.toml: the [headers.values] after for = "/*".
{
  const toml = readFileSync('netlify.toml', 'utf8');
  const block = toml.split('[[headers]]').find(b => /for\s*=\s*"\/\*"/.test(b)) ?? '';
  const headers = new Map([...block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)].map(([, k, v]) => [k.toLowerCase(), v]));
  checkHeaders('netlify.toml', headers);
}

// 3. The HTTPS redirect Worker runs before the static files on Cloudflare.
{
  const config = readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const wrangler = JSON.parse(config);
  if (wrangler.main !== 'worker/index.js') problems.push('wrangler.jsonc: the HTTPS redirect Worker (worker/index.js) is not the main script');
  if (wrangler.assets?.run_worker_first !== true) problems.push('wrangler.jsonc: assets.run_worker_first must be true, or files are served over HTTP without the redirect');
  if (!/url\.protocol === 'http:'/.test(readFileSync('worker/index.js', 'utf8'))) problems.push('worker/index.js: no longer redirects http: requests');
}

// 4. The Android app keeps student data out of Android's cloud backup and phone-to-phone transfer.
{
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  if (!/android:allowBackup="false"/.test(manifest)) problems.push('AndroidManifest.xml: allowBackup must be "false"');
  if (!/android:dataExtractionRules="@xml\/data_extraction_rules"/.test(manifest)) problems.push('AndroidManifest.xml: dataExtractionRules must point to @xml/data_extraction_rules');
  const rules = readFileSync('android/app/src/main/res/xml/data_extraction_rules.xml', 'utf8');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`).exec(rules)?.[1] ?? '';
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) {
      if (!new RegExp(`<exclude domain="${domain}" path="\\." />`).test(body)) problems.push(`data_extraction_rules.xml: ${section} doesn't exclude the ${domain} domain`);
    }
  }
}

if (problems.length) {
  console.error(`Security check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Security check passed: ${pages} pages with a strict script policy, hosting headers and the HTTPS redirect in place`);
