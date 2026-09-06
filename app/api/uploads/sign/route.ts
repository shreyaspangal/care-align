import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadRatelimit } from '@/lib/ratelimit'
import { RequestUploadSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('api:uploads:sign')

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = RequestUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { profileId, mimeType: _mimeType } = parsed.data

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { success } = await uploadRatelimit.limit(user.id)
    if (!success) {
      return NextResponse.json({ error: 'Too many uploads — try again later' }, { status: 429 })
    }

    // RLS scopes this to the caller's family — a null row means either the
    // profile doesn't exist or belongs to another family, and we don't
    // distinguish the two to the client (ANTI_PATTERNS: don't leak cross-family existence).
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, family_id')
      .eq('id', profileId)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const path = `${profileId}/${randomUUID()}`
    const { data, error } = await supabase.storage.from('documents').createSignedUploadUrl(path)
    if (error || !data) {
      log.error('sign', 'createSignedUploadUrl failed', { profileId, error: error?.message })
      return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 })
    }

    return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
  } catch (err) {
    // Every expected failure above returns its own JSON error; this catches
    // the unexpected ones (a network blip talking to Supabase/Upstash) so the
    // client always gets our error shape instead of Next's generic 500.
    log.error('sign', 'unhandled error', { profileId, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Could not prepare the upload' }, { status: 500 })
  }
}
