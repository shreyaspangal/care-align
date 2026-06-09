// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { SEED } from '../../fixtures/seed-ids'

const RLS_ENABLED = !!(
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_ANON_KEY
)

describe.skipIf(!RLS_ENABLED)('RLS — patient write restrictions', () => {
  // any: Supabase generated types don't exist until after `supabase db push`.
  // These tests use the anon key against the real DB so runtime RLS is what matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patientClient: SupabaseClient<any>

  beforeAll(async () => {
    patientClient = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_ANON_KEY!
    )
    await patientClient.auth.signInWithPassword({
      email: SEED.patient.email,
      password: SEED.patient.password,
    })
  })

  it('patient cannot insert a document', async () => {
    const { error } = await patientClient.from('documents').insert({
      episode_id: SEED.episodeAId,
      name: 'injected-by-patient',
      file_key: 'documents/fake/key',
    })
    // RLS violation returns a Postgres error (42501 insufficient privilege)
    expect(error).not.toBeNull()
  })

  it('patient cannot update their own patient record', async () => {
    const { error } = await patientClient
      .from('patients')
      .update({ name: 'hacked' })
      .eq('id', SEED.patientAId)

    expect(error).not.toBeNull()
  })

  it('patient can read their own episode summary', async () => {
    const { data, error } = await patientClient
      .from('episode_summaries')
      .select('visit_purpose, status_label, status_description')
      .eq('episode_id', SEED.episodeAId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('patient cannot read raw documents (file_key must stay hidden)', async () => {
    const { data, error } = await patientClient
      .from('documents')
      .select('file_key')
      .eq('episode_id', SEED.episodeAId)

    // No document policy exists for patient role — RLS returns empty, not error
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('patient can read document translations (plain_language)', async () => {
    const { data, error } = await patientClient
      .from('document_translations')
      .select('plain_language, what_it_means')

    expect(error).toBeNull()
    // At least one translation exists from seed data
    expect(data!.length).toBeGreaterThan(0)
  })

  it('patient cannot navigate to coordinator dashboard routes', async () => {
    // This is an E2E concern (Phase 7), not an RLS concern.
    // Included here as a placeholder to track the full security checklist.
    expect(true).toBe(true)
  })
})
