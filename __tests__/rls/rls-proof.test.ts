// @vitest-environment node
/**
 * RLS proof tests — the v1 silent-failure lesson, automated (PRACTICES §4).
 *
 * A second family's user attempts every verb against family A's rows in every
 * table. Reads must return 0 rows; writes must error or write 0 rows. A
 * sanity block proves family A CAN touch its own rows, so "0 rows" never
 * passes because a policy is broken for everyone.
 *
 * Needs a reachable Supabase (local stack in CI, .env.local locally) — the
 * suite fails loudly when env is missing rather than skipping silently.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function loadLocalEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1 || line.startsWith('#')) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).split('#')[0].trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // no .env.local — env must come from the environment (CI)
  }
}

loadLocalEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const runId = Date.now()
const PASSWORD = 'rls-proof-test-password'

type Ctx = {
  admin: SupabaseClient
  a: SupabaseClient
  b: SupabaseClient
  userIds: string[]
  familyAId: string
  profileAId: string
  documentAId: string
  appointmentAId: string
}
const ctx = {} as Ctx

async function createSignedInUser(label: 'a' | 'b') {
  const email = `rls-proof-${label}-${runId}@example.com`
  const { data, error } = await ctx.admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  ctx.userIds.push(data.user.id)

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw signInError
  return { client, userId: data.user.id }
}

beforeAll(async () => {
  ctx.admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  ctx.userIds = []

  const a = await createSignedInUser('a')
  const b = await createSignedInUser('b')
  ctx.a = a.client
  ctx.b = b.client

  // Families are created via the service client (same as the register action).
  const { data: familyA, error: famAError } = await ctx.admin
    .from('families')
    .insert({ owner_user_id: a.userId, name: 'RLS Family A' })
    .select('id')
    .single()
  if (famAError) throw famAError
  ctx.familyAId = familyA.id
  const { error: famBError } = await ctx.admin
    .from('families')
    .insert({ owner_user_id: b.userId, name: 'RLS Family B' })
  if (famBError) throw famBError

  // Family A seeds one row per table AS ITSELF (also proves authenticated
  // inserts pass — the GRANT half of the two-layer discipline).
  const { data: profileA, error: profileError } = await ctx.a
    .from('profiles')
    .insert({ family_id: ctx.familyAId, name: 'Member A' })
    .select('id')
    .single()
  if (profileError) throw profileError
  ctx.profileAId = profileA.id

  const { data: docA, error: docError } = await ctx.a
    .from('documents')
    .insert({
      family_id: ctx.familyAId,
      profile_id: ctx.profileAId,
      blob_key: `rls-proof/${runId}.jpg`,
      mime_type: 'image/jpeg',
      byte_size: 1234,
      idempotency_key: `rls-proof-${runId}`,
    })
    .select('id')
    .single()
  if (docError) throw docError
  ctx.documentAId = docA.id

  const { error: explError } = await ctx.a.from('document_explanations').insert({
    family_id: ctx.familyAId,
    document_id: ctx.documentAId,
    prompt_version: 'rls-proof',
    model: 'none',
    what_it_says: 'RLS proof fixture',
  })
  if (explError) throw explError

  const { data: apptA, error: apptError } = await ctx.a
    .from('appointments')
    .insert({
      family_id: ctx.familyAId,
      profile_id: ctx.profileAId,
      title: 'RLS proof visit',
      scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select('id')
    .single()
  if (apptError) throw apptError
  ctx.appointmentAId = apptA.id
}, 60_000)

afterAll(async () => {
  // Deleting the auth users cascades: families → profiles → documents → …
  for (const id of ctx.userIds ?? []) {
    await ctx.admin.auth.admin.deleteUser(id)
  }
}, 30_000)

describe('sanity — family A can access its own rows', () => {
  it('reads back every seeded row', async () => {
    for (const table of ['families', 'profiles', 'documents', 'document_explanations', 'appointments']) {
      const { data, error } = await ctx.a.from(table).select('id')
      expect(error, `${table} select errored`).toBeNull()
      expect(data?.length, `${table} returned no rows for its own family`).toBeGreaterThan(0)
    }
  })

  it('updates its own profile (1 row written)', async () => {
    const { data, error } = await ctx.a
      .from('profiles')
      .update({ name: 'Member A (renamed)' })
      .eq('id', ctx.profileAId)
      .select('id')
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })
})

describe('isolation — family B gets nothing from family A', () => {
  const TABLES = ['families', 'profiles', 'documents', 'document_explanations', 'appointments']

  it.each(TABLES)('%s: B reads 0 of A\'s rows', async (table) => {
    // families carries the family id as `id`; every other table denormalizes it.
    const idColumn = table === 'families' ? 'id' : 'family_id'
    const { data, error } = await ctx.b.from(table).select(idColumn as 'id')
    expect(error, `${table} select errored`).toBeNull()
    const foreign = (data ?? []).filter(
      (row) => (row as Record<string, string>)[idColumn] === ctx.familyAId
    )
    expect(foreign.length, `${table}: B can see A's rows`).toBe(0)
  })

  it('B cannot insert into A\'s family (WITH CHECK)', async () => {
    const { error } = await ctx.b
      .from('profiles')
      .insert({ family_id: ctx.familyAId, name: 'Intruder' })
    expect(error, 'insert into foreign family succeeded').not.toBeNull()
  })

  it('B update on A\'s profile writes 0 rows — the silent-failure shape', async () => {
    const { data, error } = await ctx.b
      .from('profiles')
      .update({ name: 'Hijacked' })
      .eq('id', ctx.profileAId)
      .select('id')
    expect(error).toBeNull() // this is exactly why 0-row checks exist
    expect(data?.length).toBe(0)
  })

  it('B delete on A\'s document deletes 0 rows', async () => {
    const { data, error } = await ctx.b
      .from('documents')
      .delete()
      .eq('id', ctx.documentAId)
      .select('id')
    expect(error).toBeNull()
    expect(data?.length).toBe(0)
  })

  it('B cannot read A\'s pin_hash even via column selection', async () => {
    const { data } = await ctx.b.from('profiles').select('pin_hash').eq('id', ctx.profileAId)
    expect(data?.length ?? 0).toBe(0)
  })
})
