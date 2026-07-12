import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    maxWorkers: 1,
    isolate: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'ui/**', 'anton-data/**'],
  },
});
