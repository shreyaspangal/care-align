// @vitest-environment node
/**
 * storage.objects RLS proof — the `documents` bucket, mirroring
 * __tests__/rls/rls-proof.test.ts for the tables.
 *
 * This bucket was created out-of-band (D-003 gap, see
 * supabase/migrations/20260906000000_storage_documents_rls.sql) and shipped
 * once already with a silent-deny bug (column shadowing, fixed in
 * ...000002). ANTI_PATTERNS #1/#11/#12: RLS gaps here have already cost this
 * project real incidents, and unlike the table RLS proofs, this bucket had
 * zero automated coverage before this file.
 *
 * Path convention (app/api/uploads/sign/route.ts): `${profileId}/${uuid}`.
 * The policies check that the folder's first segment is a profile belonging
 * to the caller's current_family_id() — there is no family_id column on
 * storage.objects itself to compare directly.
 *
 * INSERT, SELECT and DELETE policies exist for the owning family (Rule 3:
 * "Capture is sacred... Only the user deletes"). UPDATE (in-place overwrite)
 * is deliberately NOT granted — swapping a file's bytes in place would leave
 * document_explanations describing content that no longer exists; replacing
 * a capture is delete-then-reupload, a new document_id and a fresh organize
 * run. See supabase/migrations/20260908000001_storage_documents_rls_delete.sql.
 *
 * Needs a reachable Supabase (local stack in CI, .env.local locally) with
 * the `documents` bucket present — this file creates it if missing so a
 * fresh local/CI stack (which provisions no buckets, see config.toml) works
 * without extra setup.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
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

const BUCKET = 'documents'
const runId = Date.now()
const PASSWORD = 'rls-proof-test-password'
const FILE_BYTES = new Uint8Array([1, 2, 3, 4])

type Ctx = {
  admin: SupabaseClient
  a: SupabaseClient
  b: SupabaseClient
  userIds: string[]
  familyAId: string
  familyBId: string
  profileAId: string
  profileBId: string
  pathA: string
}
const ctx = {} as Ctx

async function createSignedInUser(label: 'a' | 'b') {
  const email = `storage-rls-proof-${label}-${runId}@example.com`
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

  const { error: bucketError } = await ctx.admin.storage.createBucket(BUCKET, { public: false })
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError

  const a = await createSignedInUser('a')
  const b = await createSignedInUser('b')
  ctx.a = a.client
  ctx.b = b.client

  const { data: familyA, error: famAError } = await ctx.admin
    .from('families')
    .insert({ owner_user_id: a.userId, name: 'Storage RLS Family A' })
    .select('id')
    .single()
  if (famAError) throw famAError
  ctx.familyAId = familyA.id

  const { data: familyB, error: famBError } = await ctx.admin
    .from('families')
    .insert({ owner_user_id: b.userId, name: 'Storage RLS Family B' })
    .select('id')
    .single()
  if (famBError) throw famBError
  ctx.familyBId = familyB.id

  const { data: profileA, error: profileAError } = await ctx.a
    .from('profiles')
    .insert({ family_id: ctx.familyAId, name: 'Storage Member A' })
    .select('id')
    .single()
  if (profileAError) throw profileAError
  ctx.profileAId = profileA.id

  const { data: profileB, error: profileBError } = await ctx.b
    .from('profiles')
    .insert({ family_id: ctx.familyBId, name: 'Storage Member B' })
    .select('id')
    .single()
  if (profileBError) throw profileBError
  ctx.profileBId = profileB.id

  ctx.pathA = `${ctx.profileAId}/${randomUUID()}.bin`

  // Family A seeds its own object AS ITSELF — also proves the INSERT policy
  // passes for a legitimate same-family upload (the GRANT half of Rule 5).
  const { error: uploadError } = await ctx.a.storage
    .from(BUCKET)
    .upload(ctx.pathA, FILE_BYTES, { contentType: 'application/octet-stream' })
  if (uploadError) throw uploadError
}, 60_000)

afterAll(async () => {
  // pathA is deleted by the "family A can delete its own object" test itself;
  // this is just a backstop in case that test fails before reaching removal.
  await ctx.admin.storage.from(BUCKET).remove([ctx.pathA])
  for (const id of ctx.userIds ?? []) {
    await ctx.admin.auth.admin.deleteUser(id)
  }
}, 30_000)

describe('sanity — family A can access its own object', () => {
  it('downloads its own uploaded object', async () => {
    const { data, error } = await ctx.a.storage.from(BUCKET).download(ctx.pathA)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  it('lists its own profile folder', async () => {
    const { data, error } = await ctx.a.storage.from(BUCKET).list(ctx.profileAId)
    expect(error).toBeNull()
    expect(data?.some((entry) => ctx.pathA.endsWith(entry.name))).toBe(true)
  })
})

describe("isolation — family B cannot touch family A's object", () => {
  it("cannot download A's object", async () => {
    const { data, error } = await ctx.b.storage.from(BUCKET).download(ctx.pathA)
    // Storage returns a 400/404-style error rather than an empty payload for
    // a denied download — either shape is an isolation pass, a real payload
    // is not.
    expect(data, "B downloaded A's object").toBeNull()
    expect(error).not.toBeNull()
  })

  it("lists A's profile folder as empty (not an error — the silent-failure shape)", async () => {
    const { data, error } = await ctx.b.storage.from(BUCKET).list(ctx.profileAId)
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(0)
  })

  it("cannot upload into A's profile folder (WITH CHECK)", async () => {
    const { error } = await ctx.b.storage
      .from(BUCKET)
      .upload(`${ctx.profileAId}/${randomUUID()}.bin`, FILE_BYTES, {
        contentType: 'application/octet-stream',
      })
    expect(error, "B's upload into A's folder succeeded").not.toBeNull()
  })

  it("cannot overwrite A's object via upsert", async () => {
    const { error } = await ctx.b.storage
      .from(BUCKET)
      .upload(ctx.pathA, new Uint8Array([9, 9, 9]), { upsert: true })
    expect(error, "B's upsert onto A's object succeeded").not.toBeNull()
  })

  it("cannot remove A's object", async () => {
    const { data, error } = await ctx.b.storage.from(BUCKET).remove([ctx.pathA])
    // storage-js returns 200 with an empty `data` array for a denied
    // remove rather than an error — the same silent-failure shape as a
    // 0-row table delete, so assert on the array being empty, not on `error`.
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(0)

    const { error: stillThereError } = await ctx.admin.storage.from(BUCKET).download(ctx.pathA)
    expect(stillThereError, "A's object was actually deleted by B's request").toBeNull()
  })
})

describe('no UPDATE policy — by design, not a gap (see migration 20260908000001)', () => {
  it('family A itself cannot upsert-overwrite its own object', async () => {
    const { error } = await ctx.a.storage
      .from(BUCKET)
      .upload(ctx.pathA, new Uint8Array([9, 9, 9]), { upsert: true })
    expect(error, "A's own upsert succeeded despite no UPDATE policy").not.toBeNull()
  })
})

describe('deletion — family A can delete its own object (Rule 3: only the user deletes)', () => {
  // Runs last: it consumes pathA, which every test above depends on existing.
  it("family A removes its own object", async () => {
    const { data, error } = await ctx.a.storage.from(BUCKET).remove([ctx.pathA])
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(1)

    const { error: goneError } = await ctx.admin.storage.from(BUCKET).download(ctx.pathA)
    expect(goneError, "A's object still exists after A's own delete").not.toBeNull()
  })
})
