// Removes the Next.js version from the static build, so the published scripts don't tell anyone which framework
// release the app was built with (CWE-200: information exposure). Next.js writes its version into the client
// bundle (window.next.version), which is what fingerprinting tools read; the app itself never uses it.
//
// Next.js 16 also writes it at the end of a template string, as part of the name of a shared global
// (`@next/${name}@<version>`); that suffix is removed too, which is safe because only one copy of Next.js is ever
// on a page.
//
// Runs after `next build` for the static export and before the service worker is generated, which lists the
// final files. It replaces the quoted version string with an empty one, then checks that the version no longer
// appears anywhere in out/, and fails the build if it does (for example after a Next.js update that writes it
// somewhere new), so the leak can't come back unnoticed.
//
// This only hides a detail; it is not a substitute for keeping Next.js up to date (Dependabot does that).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
const version = JSON.parse(readFileSync('node_modules/next/package.json', 'utf8')).version;
const escaped = version.replace(/\./g, '\\.');
const quoted = new RegExp(`(["'])${escaped}\\1`, 'g');
const templateSuffix = new RegExp(`(\`[^\`]*@)${escaped}(\`)`, 'g');

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let replaced = 0;
for (const path of files(join(OUT, '_next', 'static'))) {
  if (!/\.(m?js)$/.test(path)) continue;
  const text = readFileSync(path, 'utf8');
  const next = text
    .replace(quoted, (_m, q) => { replaced++; return `${q}${q}`; })
    .replace(templateSuffix, (_m, head, tick) => { replaced++; return `${head}${tick}`; });
  if (next !== text) writeFileSync(path, next);
}

const leaks = [];
for (const path of files(OUT)) {
  if (!/\.(m?js|html|json|txt)$/.test(path)) continue;
  if (readFileSync(path, 'utf8').includes(version)) leaks.push(path);
}
if (leaks.length) {
  console.error(`The Next.js version ${version} still appears in the build:\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
console.log(`Removed the Next.js version from ${replaced} place${replaced === 1 ? '' : 's'} in the build`);
