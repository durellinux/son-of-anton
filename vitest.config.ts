import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/ui/**', 'anton-data/**'],
  },
});
