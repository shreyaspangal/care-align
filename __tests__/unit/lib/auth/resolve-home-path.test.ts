import { describe, expect, it } from 'vitest'
import { resolveHomePath } from '@/lib/auth/resolve-home-path'

describe('resolveHomePath', () => {
  it('sends a user with exactly one access row straight to that patient\'s summary', () => {
    expect(resolveHomePath([{ patient_id: 'patient-1' }])).toBe('/dashboard/patient-1/summary')
  })

  it('sends a user with zero access rows to the dashboard shell', () => {
    expect(resolveHomePath([])).toBe('/dashboard')
  })

  it('sends a user with multiple access rows (any role mix) to the dashboard shell', () => {
    expect(resolveHomePath([{ patient_id: 'patient-1' }, { patient_id: 'patient-2' }])).toBe('/dashboard')
  })
})
