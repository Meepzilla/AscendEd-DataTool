import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Next.js's recommended lint rules (React, hooks, accessibility basics, TypeScript). Run with `npm run lint`.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'out/**', 'android/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Stored dates can be date-only ("2026-11-09", as imported sessions have). `new Date()` reads those as UTC
    // midnight, which is the evening before in US time zones, so a session lands on the wrong day. Read a
    // `.date` with parseDateOnly() (src/lib/helpers.ts), which reads a date-only value as that local day.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "NewExpression[callee.name='Date'] > MemberExpression.arguments:first-child[property.name='date']",
          message: 'Use parseDateOnly(x.date) instead of new Date(x.date): a date-only value would land on the previous day west of UTC.',
        },
        {
          selector: "NewExpression[callee.name='Date'] > LogicalExpression.arguments:first-child > MemberExpression.left[property.name='date']",
          message: "Use parseDateOnly(x.date ?? '') instead of new Date(x.date ?? ''): a date-only value would land on the previous day west of UTC.",
        },
      ],
    },
  },
  {
    rules: {
      // Loose `any` types are being replaced gradually; they warn for now instead of failing.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused function arguments can be kept when named with a leading underscore.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
