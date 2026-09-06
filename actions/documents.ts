'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  CreateDocumentSchema,
  type CreateDocumentInput,
  UpdateDocumentDetailsSchema,
  type UpdateDocumentDetailsInput,
} from '@/lib/validation/schemas'
import { organizeDocument } from '@/lib/ai/organize'
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
  // Only the genuine first insert triggers organize — a replayed retry above
  // already returned early, so this never double-runs it for one document.
  after(() => organizeDocument(data.id))
  return { success: true, documentId: data.id }
}

export type DocumentActionResult = { success: true } | { success: false; error: string }

// Both actions below run with the caller's own (cookie-scoped) client, not
// the service client — the documents_family RLS policy already restricts
// .update() to rows in the caller's own family, so a cross-family documentId
// simply matches 0 rows. The .select().maybeSingle() after every update is
// what makes that visible: without it, a 0-row match and a real success look
// identical (ANTI_PATTERNS #1 — the exact v1 silent-failure shape).

export async function retryOrganize(documentId: string): Promise<DocumentActionResult> {
  const parsed = z.uuid().safeParse(documentId)
  if (!parsed.success) {
    return { success: false, error: 'Invalid document' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not signed in' }
  }

  const { data, error } = await supabase
    .from('documents')
    .update({ status: 'uploaded' })
    .eq('id', documentId)
    .select('id, profile_id')
    .maybeSingle()
  if (error || !data) {
    log.error('retryOrganize', 'update failed', { documentId, error: error?.message })
    return { success: false, error: 'Could not retry — document not found' }
  }

  revalidatePath(`/p/${data.profile_id}`)
  after(() => organizeDocument(documentId))
  return { success: true }
}

export async function updateDocumentDetails(
  input: UpdateDocumentDetailsInput
): Promise<DocumentActionResult> {
  const parsed = UpdateDocumentDetailsSchema.safeParse(input)
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

  const { data, error } = await supabase
    .from('documents')
    .update({
      doc_type: parsed.data.docType,
      title: parsed.data.title,
      title_is_guessed: false,
      document_date: parsed.data.documentDate,
      doctor_name: parsed.data.doctorName,
      facility_name: parsed.data.facilityName,
      status: 'organized',
    })
    .eq('id', parsed.data.documentId)
    .select('id, profile_id')
    .maybeSingle()
  if (error || !data) {
    log.error('updateDocumentDetails', 'update failed', {
      documentId: parsed.data.documentId,
      error: error?.message,
    })
    return { success: false, error: 'Could not save — document not found' }
  }

  revalidatePath(`/p/${data.profile_id}`)
  return { success: true }
}
