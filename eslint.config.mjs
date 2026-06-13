import nextConfig from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'worktrees/**',
      '.claude/**',
      '.vercel/**',
      'packages/*/dist/**',
      // Committed static assets (e.g. marimo WASM exports under public/marimo/) are
      // generated, minified bundles — never our source to lint.
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // React Compiler rules (added in react-hooks v6) catch interesting
      // patterns but are noisy on hand-written canvas/concept components.
      // Downgrade to warnings; revisit per-file when moving to React Compiler.
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/purity': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
];
