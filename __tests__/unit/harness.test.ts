import { describe, expect, it } from 'vitest'

// Phase 1 smoke test: proves the Vitest harness, the `@` alias, and the
// jsdom + jest-dom setup all load. Real unit tests replace/extend this from
// Phase 4 onward. Safe to delete once those exist.
describe('test harness', () => {
  it('runs and resolves the @ alias', async () => {
    const { cn } = await import('@/lib/utils')
    expect(cn('a', 'b')).toBe('a b')
  })
})
