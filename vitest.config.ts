import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors tsconfig "paths": { "@/*": ["./*"] } — alias to repo root (no src/).
    alias: {
      '@': path.resolve(dirname, './')
    }
  },
  test: {
    projects: [{
      extends: true,
      test: {
        environment: 'jsdom',
        setupFiles: ['__tests__/setup.ts'],
        globals: true,
        // Playwright specs live in __tests__/e2e and run via `pnpm test:e2e`,
        // not Vitest. Real-Claude AI tests run via `pnpm test:ai`. Exclude both
        // from the default fast suite.
        exclude: ['**/node_modules/**', '**/__tests__/e2e/**', '**/__tests__/ai/**']
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});