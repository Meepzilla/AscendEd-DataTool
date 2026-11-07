import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next.js's recommended lint rules (React, hooks, accessibility basics, TypeScript). Run with `npm run lint`.

export default [
  { ignores: ['.next/**', 'out/**', 'android/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // New in the React rules that came with Next.js 16: they flag patterns the app uses on purpose (such as reading
      // saved settings after the first render so the page matches its pre-built HTML). They warn so they can be
      // reviewed one by one instead of rewriting every effect at once.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      // Loose `any` types are being replaced gradually; they warn for now instead of failing.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused function arguments can be kept when named with a leading underscore.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
