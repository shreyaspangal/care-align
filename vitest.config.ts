import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['__tests__/setup.ts'],
    globals: true,
    // Playwright specs live in __tests__/e2e and run via `pnpm test:e2e`,
    // not Vitest. Real-Claude AI tests run via `pnpm test:ai`. Exclude both
    // from the default fast suite.
    exclude: [
      '**/node_modules/**',
      '**/__tests__/e2e/**',
      '**/__tests__/ai/**',
    ],
  },
  resolve: {
    // Mirrors tsconfig "paths": { "@/*": ["./*"] } — alias to repo root (no src/).
    alias: { '@': path.resolve(__dirname, './') },
  },
})
