import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Engine purity (PRD §0.4 rule 1): /engine is data in, data out.
// engine/purity.test.ts enforces the same rule in `npm test`; this gives editor feedback.
const ENGINE_FORBIDDEN_MODULES = [
  'react',
  'react-dom',
  'fs',
  'fs/promises',
  'net',
  'http',
  'https',
  'http2',
  'tls',
  'dgram',
  'child_process',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'data/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['engine/**/*.ts'],
    ignores: ['engine/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ENGINE_FORBIDDEN_MODULES.map((name) => ({
            name,
            message: '/engine must stay headless (PRD §0.4).',
          })),
          patterns: [
            {
              group: ['node:*', 'react/*', 'react-dom/*'],
              message: '/engine must stay headless (PRD §0.4).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'fetch',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'XMLHttpRequest',
          'navigator',
          'WebSocket',
        ].map((name) => ({ name, message: '/engine must stay headless (PRD §0.4).' })),
      ],
    },
  },
);
