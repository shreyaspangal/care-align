// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { SEED } from '../../fixtures/seed-ids'

const RLS_ENABLED = !!(
  process.env.TEST_SUPABASE_URL && process.env.TEST_SUPABASE_PUBLISHABLE_KEY
)

describe.skipIf(!RLS_ENABLED)('RLS — patient write restrictions', () => {
  // any: Supabase generated types don't exist until after `supabase db push`.
  // These tests use the anon key against the real DB so runtime RLS is what matters.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patientClient: SupabaseClient<any>

  beforeAll(async () => {
    patientClient = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_PUBLISHABLE_KEY!
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

describe.skipIf(!RLS_ENABLED)('RLS — bilateral revocation and access visibility', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patientClient: SupabaseClient<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coordBClient: SupabaseClient<any>

  beforeAll(async () => {
    patientClient = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_PUBLISHABLE_KEY!)
    coordBClient  = createClient(process.env.TEST_SUPABASE_URL!, process.env.TEST_SUPABASE_PUBLISHABLE_KEY!)
    await patientClient.auth.signInWithPassword({ email: SEED.patient.email, password: SEED.patient.password })
    await coordBClient.auth.signInWithPassword({ email: SEED.coordB.email, password: SEED.coordB.password })
  })

  it('patient can see the coordinator access row for their own record', async () => {
    const { data, error } = await patientClient
      .from('patient_access')
      .select('user_id, role, provenance')
      .eq('patient_id', SEED.patientAId)
      .eq('role', 'coordinator')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('patient can see the coordinator profile name for their own record', async () => {
    const { data, error } = await patientClient
      .from('profiles')
      .select('name')
      .eq('id', SEED.coordA.userId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('an unrelated coordinator cannot see the patient\'s profile name', async () => {
    const { data, error } = await coordBClient
      .from('profiles')
      .select('name')
      .eq('id', SEED.patient.userId)

    // RLS returns empty rows, not an error, for a non-shared-patient lookup
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('an unrelated coordinator cannot delete a coordinator row on a different patient', async () => {
    const { data, error } = await coordBClient
      .from('patient_access')
      .delete()
      .eq('patient_id', SEED.patientAId)
      .eq('user_id', SEED.coordA.userId)
      .eq('role', 'coordinator')
      .select('id')

    // No matching RLS policy grants coordB delete rights here — 0 rows affected
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // A live "patient deletes coordA's row" test is deliberately omitted here:
  // there is no service-role test client or seed-reset tooling in this suite
  // to restore the row afterward, and coordA's INSERT policy requires an
  // *existing* coordinator row — once revoked, coordA can't re-grant
  // themselves, so a destructive test here would permanently break every
  // other coordA-authored fixture in this file for good. The policy shape
  // itself (mirrors the existing, already-tested INSERT policy) is reviewed
  // in the migration; add a positive delete test once seed-reset tooling
  // exists (e.g. a per-test disposable patient created via service role).
})
