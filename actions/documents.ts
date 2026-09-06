'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CreateDocumentSchema, type CreateDocumentInput } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('actions:documents')

export type CreateDocumentResult =
  | { success: true; documentId: string }
  | { success: false; error: string }

export async function createDocument(input: CreateDocumentInput): Promise<CreateDocumentResult> {
  const parsed = CreateDocumentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not signed in' }
  }

  const { data: family } = await supabase.from('families').select('id').maybeSingle()
  if (!family) {
    return { success: false, error: 'No family found for this account' }
  }

  // RLS scopes this to the caller's family — a null row means profileId
  // belongs to a different family. Without this check, family_id (correctly
  // the caller's own) and profile_id (from client input) could disagree,
  // producing a document that's visible to this family but attached to
  // another family's profile — there is no DB-level constraint tying
  // documents.profile_id to documents.family_id, only the app layer.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.profileId)
    .maybeSingle()
  if (!profile) {
    return { success: false, error: 'Profile not found' }
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      family_id: family.id,
      profile_id: parsed.data.profileId,
      blob_key: parsed.data.blobKey,
      mime_type: parsed.data.mimeType,
      byte_size: parsed.data.byteSize,
      width: parsed.data.width,
      height: parsed.data.height,
      idempotency_key: parsed.data.idempotencyKey,
    })
    .select('id')
    .single()

  if (error) {
    // Unique violation on idempotency_key means this is a client retry of an
    // already-succeeded upload, not a real failure — return the existing row.
    if (error.code === '23505') {
      const { data: existing, error: lookupError } = await supabase
        .from('documents')
        .select('id')
        .eq('idempotency_key', parsed.data.idempotencyKey)
        .maybeSingle()
      if (lookupError || !existing) {
        log.error('createDocument', 'idempotency replay lookup failed', {
          error: lookupError?.message,
        })
        return { success: false, error: 'Could not save the document' }
      }
      return { success: true, documentId: existing.id }
    }

    log.error('createDocument', 'insert failed', { error: error.message })
    return { success: false, error: 'Could not save the document' }
  }

  revalidatePath(`/p/${parsed.data.profileId}`)
  return { success: true, documentId: data.id }
}
