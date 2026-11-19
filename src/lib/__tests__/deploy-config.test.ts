import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { GOAL_TYPE_VALUES } from '../types';
import { GOAL_TYPE_SCREENSHOTS } from '../goal-type-screenshots';

// The app is hosted on both Netlify (netlify.toml) and Cloudflare (public/_headers), each with its own copy of the
// response headers. These tests fail when the two copies differ, so a header changed on one host is changed on both.

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

type HeaderRules = Record<string, Record<string, string>>;

/** public/_headers: a path line, then indented "Name: value" lines. */
function parseHeadersFile(text: string): HeaderRules {
  const rules: HeaderRules = {};
  let current: Record<string, string> | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { current = rules[line.trim()] = {}; continue; }
    const at = line.indexOf(':');
    if (current && at > 0) current[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return rules;
}

/** netlify.toml: each [[headers]] block's `for` path and its [headers.values]. */
function parseNetlifyHeaders(text: string): HeaderRules {
  const rules: HeaderRules = {};
  for (const block of text.split('[[headers]]').slice(1)) {
    const forPath = /for\s*=\s*"([^"]+)"/.exec(block)?.[1];
    if (!forPath) continue;
    const values: Record<string, string> = {};
    const body = block.split('[headers.values]')[1] ?? '';
    for (const m of body.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)) values[m[1]] = m[2];
    rules[forPath] = values;
  }
  return rules;
}

describe('hosting configuration', () => {
  it('Netlify and Cloudflare send the same response headers', () => {
    const cloudflare = parseHeadersFile(read('public/_headers'));
    const netlify = parseNetlifyHeaders(read('netlify.toml'));
    expect(Object.keys(cloudflare).length).toBeGreaterThan(0);
    expect(cloudflare).toEqual(netlify);
  });

  it('both keep the app out of frames and limit where it can send data', () => {
    const csp = parseHeadersFile(read('public/_headers'))['/*']['Content-Security-Policy'];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('both send HSTS and a Permissions-Policy that disables features the app never uses', () => {
    // The parity test above pins netlify.toml to the same values, so asserting on the Cloudflare copy
    // covers both hosts.
    const rules = parseHeadersFile(read('public/_headers'))['/*'];
    expect(rules['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(rules['Permissions-Policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );
  });
});

describe('goal bank data', () => {
  // goal-bank.json is bundled (the templates); public/goal-bank/details.json is fetched only when a template's
  // details are opened (purpose, activity ideas, tags). They are split on purpose to keep the app's code small.
  it('every goal bank template has its details, and every details entry has a template', () => {
    const bank = JSON.parse(read('src/lib/goal-constants/goal-bank.json')) as { bankId: string }[];
    const details = JSON.parse(read('public/goal-bank/details.json')) as Record<string, unknown>;
    const ids = new Set(bank.map(t => t.bankId));
    expect([...ids].filter(id => !(id in details))).toEqual([]);
    expect(Object.keys(details).filter(id => !ids.has(id))).toEqual([]);
  });
});

describe('goal type help screenshots', () => {
  // Help → Goal types shows a Data Entry screenshot for every GoalType. Kept in sync with GOAL_TYPE_VALUES
  // so no new goal type ships without its screenshot and no unused image bloats the offline precache.
  it('every goal type has a valid WebP screenshot and no orphaned files exist', () => {
    const dir = path.join(root, 'public/help/goal-types');
    const filesOnDisk = new Set(readdirSync(dir));
    const referenced = new Set<string>();

    for (const type of GOAL_TYPE_VALUES) {
      const entry = GOAL_TYPE_SCREENSHOTS[type];
      expect(entry, `Missing screenshot entry for ${type}`).toBeDefined();
      expect(entry.width).toBeGreaterThan(0);
      expect(entry.height).toBeGreaterThan(0);
      expect(entry.src.startsWith('/help/goal-types/')).toBe(true);

      const filename = path.basename(entry.src);
      referenced.add(filename);
      expect(filesOnDisk.has(filename), `Missing file public${entry.src}`).toBe(true);

      const bytes = readFileSync(path.join(dir, filename));
      expect(bytes.length).toBeGreaterThan(5000);
      // WebP container magic bytes: "RIFF" at 0..3 and "WEBP" at 8..11.
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    }

    expect([...filesOnDisk].filter(f => !referenced.has(f))).toEqual([]);
  });
});
