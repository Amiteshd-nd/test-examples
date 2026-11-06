import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'engine/**/*.test.ts',
      'frontend/**/*.test.{ts,tsx}',
      'server/**/*.test.ts',
      'tools/**/*.test.ts',
    ],
    passWithNoTests: true,
  },
});
