/// <reference types="vitest/globals" />
// Makes Vitest's global APIs (describe, it, expect, vi, beforeAll, ...) known to
// TypeScript for test files that use them without an explicit import, matching
// `globals: true` in vitest.config.ts. Scoped here so it does not widen globals
// for application code.
