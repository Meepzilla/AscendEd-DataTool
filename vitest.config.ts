import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the app's logic (src/**/*.test.ts). Run with `npm test`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
