import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the app's logic (src/**/*.test.ts). Run with `npm test`.
//
// Tests run in US Pacific time on every machine, CI included. Date-only values (YYYY-MM-DD) read as UTC midnight land
// on the previous day west of UTC; in UTC that bug is invisible, so date tests would pass whether or not it is there.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
