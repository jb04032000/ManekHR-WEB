import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Vitest - frontend unit + component tests for Zari360 Connect.
 *
 * Backend tests run under the backend repo's own Vitest. E2E is Playwright
 * (`test:e2e`). See docs/connect/TESTING-STRATEGY.md.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['{app,components,features,lib,hooks}/**/*.{test,vitest}.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
