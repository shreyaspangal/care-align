'use server'

import { createClient } from '@/lib/supabase/server'
import { validateDocumentFile } from '@/lib/storage/validate'
import { uploadToBlob } from '@/lib/storage/blob'
import { uploadRatelimit } from '@/lib/ratelimit'
import { createLogger } from '@/lib/logger'
import { UploadHintsSchema, type UploadHints } from '@/lib/validation/schemas'

const log = createLogger('uploadDocument')

export type UploadDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string }

export async function uploadDocument(
  episodeId: string,
  formData: FormData
): Promise<UploadDocumentResult> {
  // Extract and validate optional coordinator hints.
  // Hints are advisory — they are passed to Claude as context, not overrides.
  // custom_type is stored in purpose when type = 'other' and a label was provided.
  const hintsRaw = {
    type: (formData.get('hint_type') as string) || undefined,
    custom_type: (formData.get('hint_custom_type') as string) || undefined,
    source_hospital: (formData.get('hint_source_hospital') as string) || undefined,
  }
  const hintsResult = UploadHintsSchema.safeParse(hintsRaw)
  if (!hintsResult.success) {
    log.warn('upload', 'invalid upload hints', { errors: hintsResult.error.flatten() })
    return { ok: false, error: 'Invalid upload options provided.' }
  }
  const hints = hintsResult.data
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  log.debug('upload', 'user authenticated', { userId: user.id, episodeId })

  // Rate limit — 10 uploads per user per hour
  const { success, remaining } = await uploadRatelimit.limit(user.id)
  log.debug('upload', 'rate limit check', { success, remaining, userId: user.id })
  if (!success) {
    log.warn('upload', 'rate limit exceeded', { userId: user.id })
    return { ok: false, error: 'Too many uploads. Please wait before uploading again.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided.' }

  log.debug('upload', 'file received', { name: file.name, size: file.size, type: file.type })

  // Validate MIME type and size via Zod schema
  const validation = validateDocumentFile(file)
  if (!validation.ok) {
    log.warn('upload', 'file validation failed', { error: validation.error, file: file.name })
    return { ok: false, error: validation.error }
  }

  // Create Document record first — gets an ID for the Blob path.
  // Seed any coordinator-provided hints immediately so the UI shows them
  // while classification is pending. Claude will confirm or correct these.
  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      episode_id: episodeId,
      name: file.name,
      file_key: 'pending',
      status: 'pending_classification',
      // Hint fields — may be undefined (null in DB) until Claude classifies
      ...(hints.type && { type: hints.type }),
      ...(hints.source_hospital && { source_hospital: hints.source_hospital }),
      // custom_type stored in purpose when type = 'other'; Claude will refine
      ...(hints.type === 'other' && hints.custom_type && { purpose: hints.custom_type }),
    })
    .select('id')
    .single()

  if (insertError || !document) {
    log.error('upload', 'document record insert failed', {
      error: insertError?.message,
      code: insertError?.code,
    })
    return { ok: false, error: 'Failed to create document record.' }
  }

  log.info('upload', 'document record created', { documentId: document.id, episodeId })

  // Upload to Vercel Blob — private, keyed by episode + document ID
  let fileKey: string
  try {
    fileKey = await uploadToBlob(file, episodeId, document.id)
    log.info('upload', 'blob upload successful', { documentId: document.id, fileKey })
  } catch (err) {
    log.error('upload', 'blob upload failed — marking document as failed', {
      documentId: document.id,
      error: err instanceof Error ? err.message : String(err),
    })
    // Mark as failed, do not delete the record
    await supabase
      .from('documents')
      .update({ status: 'failed' })
      .eq('id', document.id)
    return { ok: false, error: 'File upload failed. Please try again.' }
  }

  // Update record with real file_key
  const { error: updateError } = await supabase
    .from('documents')
    .update({ file_key: fileKey })
    .eq('id', document.id)

  if (updateError) {
    log.error('upload', 'failed to persist file_key', {
      documentId: document.id,
      error: updateError.message,
    })
    return { ok: false, error: 'Failed to save file reference.' }
  }

  log.info('upload', 'upload pipeline complete', { documentId: document.id, episodeId })
  return { ok: true, documentId: document.id }
}
