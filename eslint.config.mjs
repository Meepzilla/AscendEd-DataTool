import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

// Next.js's recommended lint rules (React, hooks, accessibility basics, TypeScript). Run with `npm run lint`.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'out/**', 'android/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Loose `any` types are being replaced gradually; they warn for now instead of failing.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused function arguments can be kept when named with a leading underscore.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
