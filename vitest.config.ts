import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['areaEdit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['areaEdit/**/*.ts'],
      exclude: ['areaEdit/**/*.test.ts'],
    },
  },
});
