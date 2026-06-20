import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    maxWorkers: 1,
    isolate: false,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'ui'],
  },
});
