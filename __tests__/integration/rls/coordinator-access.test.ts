// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { SEED } from '../../fixtures/seed-ids'

// These tests require a real Supabase test project with seed data applied.
// They are skipped when TEST_SUPABASE_URL is not set so the fast suite stays fast.
const RLS_ENABLED = !!(
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_ANON_KEY
)

describe.skipIf(!RLS_ENABLED)('RLS — coordinator isolation', () => {
  // Clients are created inside beforeAll so module-level evaluation doesn't
  // throw when TEST_SUPABASE_URL is absent (describe.skipIf skips the suite
  // but module-level createClient() would still execute).
  // any: Supabase generated types don't exist until after `supabase db push`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coordA: SupabaseClient<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coordB: SupabaseClient<any>

  beforeAll(async () => {
    coordA = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_ANON_KEY!
    )
    coordB = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_ANON_KEY!
    )
    await coordA.auth.signInWithPassword({
      email: SEED.coordA.email,
      password: SEED.coordA.password,
    })
    await coordB.auth.signInWithPassword({
      email: SEED.coordB.email,
      password: SEED.coordB.password,
    })
  })

  it('coordinator A cannot read coordinator B patients', async () => {
    const { data, error } = await coordA
      .from('patients')
      .select('*')
      .eq('id', SEED.patientBId)

    // RLS returns empty rows for unauthorized access, not an error
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('coordinator A cannot read coordinator B episodes', async () => {
    const { data, error } = await coordA
      .from('episodes')
      .select('*')
      .eq('patient_id', SEED.patientBId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('coordinator A can read their own patient', async () => {
    const { data, error } = await coordA
      .from('patients')
      .select('id, name')
      .eq('id', SEED.patientAId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })
})
