import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'netlify/functions/__tests__/**/*.test.{js,ts}',
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'netlify/functions/*.js'],
      exclude: ['src/test/**', 'src/**/__tests__/**', 'netlify/functions/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
