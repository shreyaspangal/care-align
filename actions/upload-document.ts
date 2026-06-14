'use server'

import { NoOutputGeneratedError } from 'ai'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateDocumentFile } from '@/lib/storage/validate'
import { uploadToBlob, getSignedBlobUrl } from '@/lib/storage/blob'
import { uploadRatelimit } from '@/lib/ratelimit'
import { UploadHintsSchema, type UploadHints } from '@/lib/validation/schemas'
import { classifyDocument } from '@/lib/ai/classify'
import { translateDocument } from '@/lib/ai/translate'
import { regenerateEpisodeSummary, type DocumentSummaryInput } from '@/lib/ai/summarise'
import { upsertEpisodeSummary } from '@/lib/db/episode-summaries'
import { createLogger } from '@/lib/logger'

const log = createLogger('uploadDocument')

export type UploadDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string }

export async function uploadDocument(
  episodeId: string,
  formData: FormData
): Promise<UploadDocumentResult> {
  const hintsResult = UploadHintsSchema.safeParse({
    type: (formData.get('hint_type') as string) || undefined,
    custom_type: (formData.get('hint_custom_type') as string) || undefined,
    source_hospital: (formData.get('hint_source_hospital') as string) || undefined,
  })
  if (!hintsResult.success) {
    log.warn('upload', 'invalid upload hints', { errors: hintsResult.error.flatten() })
    return { ok: false, error: 'Invalid upload options provided.' }
  }
  const hints: UploadHints = hintsResult.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  const { success, remaining } = await uploadRatelimit.limit(user.id)
  log.debug('upload', 'rate limit check', { success, remaining, userId: user.id })
  if (!success) {
    log.warn('upload', 'rate limit exceeded', { userId: user.id })
    return { ok: false, error: 'Too many uploads. Please wait before uploading again.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided.' }

  const validation = validateDocumentFile(file)
  if (!validation.ok) {
    log.warn('upload', 'file validation failed', { error: validation.error, file: file.name })
    return { ok: false, error: validation.error }
  }

  // Create record before blob upload so we have an ID for the blob path.
  // Hint fields are seeded immediately so the UI shows something while AI runs.
  const { data: document, error: insertError } = await supabase
    .from('documents')
    .insert({
      episode_id: episodeId,
      name: file.name,
      file_key: 'pending',
      status: 'pending_classification',
      ...(hints.type && { type: hints.type }),
      ...(hints.source_hospital && { source_hospital: hints.source_hospital }),
      ...(hints.type === 'other' && hints.custom_type && { purpose: hints.custom_type }),
    })
    .select('id')
    .single()

  if (insertError || !document) {
    log.error('upload', 'document record insert failed', { error: insertError?.message })
    return { ok: false, error: 'Failed to create document record.' }
  }

  const documentId = document.id
  log.info('upload', 'document record created', { documentId, episodeId })

  // Helper: mark failed and return — record is preserved for audit/retry
  const fail = async (reason: string, logMsg: string, extra?: object) => {
    log.error('upload', logMsg, { documentId, ...extra })
    await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId)
    return { ok: false as const, error: reason }
  }

  // ── Blob upload ────────────────────────────────────────────────────────────
  let fileKey: string
  try {
    fileKey = await uploadToBlob(file, episodeId, documentId)
    log.info('upload', 'blob upload complete', { documentId, fileKey })
  } catch (err) {
    return fail('File upload failed. Please try again.', 'blob upload failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  await supabase.from('documents').update({ file_key: fileKey }).eq('id', documentId)

  // Read file into buffer once — reused for classify + translate calls
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type

  // ── Classification ─────────────────────────────────────────────────────────
  let classification
  try {
    classification = await classifyDocument(fileBuffer, mimeType, {
      type: hints.type,
      hospital: hints.source_hospital,
    })
    log.info('upload', 'classification complete', { documentId, type: classification.type })
  } catch (err) {
    if (NoOutputGeneratedError.isInstance(err)) {
      return fail('Could not classify document.', 'classification failed — NoOutputGenerated')
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('credit balance is too low')) {
      return fail('AI service unavailable — credit balance exhausted. Contact the administrator.', 'classification error — billing', { error: msg })
    }
    return fail('Classification failed. Please try again.', 'classification error', { error: msg })
  }

  await supabase
    .from('documents')
    .update({
      status: 'classified',
      type: classification.type,
      // When Claude inferred rather than extracted the name, prefix it so the
      // coordinator and audit trail know it is a guess, not a verbatim extraction.
      name: classification.name_is_guessed
        ? `[Inferred] ${classification.suggested_name}`
        : classification.suggested_name,
      purpose: classification.suggested_purpose,
      document_date: classification.document_date,
      source_hospital: classification.source_hospital,
      source_department: classification.source_department,
    })
    .eq('id', documentId)

  // ── Translation ────────────────────────────────────────────────────────────

  // Fetch patient name for personalised prompts
  const { data: episode } = await supabase
    .from('episodes')
    .select('patients(profiles(name))')
    .eq('id', episodeId)
    .single()

  const patientName =
    (episode?.patients as { profiles?: { name?: string } } | null)?.profiles?.name ?? 'the patient'

  let translation
  try {
    translation = await translateDocument(fileBuffer, mimeType, classification.type, patientName)
    log.info('upload', 'translation complete', { documentId, actionCount: translation.actions.length })
  } catch (err) {
    if (NoOutputGeneratedError.isInstance(err)) {
      return fail('Could not translate document.', 'translation failed — NoOutputGenerated')
    }
    return fail('Translation failed. Please try again.', 'translation error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const { data: translationRecord, error: translationError } = await supabase
    .from('document_translations')
    .insert({
      document_id: documentId,
      plain_language: translation.plain_language,
      what_it_means: translation.what_it_means,
      prompt_version: 'v1',
    })
    .select('id')
    .single()

  if (translationError || !translationRecord) {
    return fail('Failed to save translation.', 'translation insert failed', {
      error: translationError?.message,
    })
  }

  // Insert document_actions (immutable AI audit trail)
  if (translation.actions.length > 0) {
    const { error: actionsError } = await supabase.from('document_actions').insert(
      translation.actions.map((a) => ({
        translation_id: translationRecord.id,
        action_for: a.action_for,
        category: a.category,
        phase_appears: a.phase_appears,
        description: a.description,
      }))
    )
    if (actionsError) {
      log.warn('upload', 'document_actions insert failed — continuing', {
        documentId,
        error: actionsError.message,
      })
    }

    // Promote to pending_tasks (coordinator working list)
    const { error: tasksError } = await supabase.from('pending_tasks').insert(
      translation.actions.map((a) => ({
        episode_id: episodeId,
        action_for: a.action_for,
        category: a.category,
        phase_appears: a.phase_appears,
        description: a.description,
      }))
    )
    if (tasksError) {
      log.warn('upload', 'pending_tasks insert failed — continuing', {
        documentId,
        error: tasksError.message,
      })
    }
  }

  await supabase
    .from('documents')
    .update({ status: 'translated' })
    .eq('id', documentId)

  // ── Episode summary regeneration (non-fatal) ───────────────────────────────
  try {
    const { data: episodeRow } = await supabase
      .from('episodes')
      .select('started_at')
      .eq('id', episodeId)
      .single()

    const { data: allTranslations } = await supabase
      .from('document_translations')
      .select('plain_language, what_it_means, documents(type, document_date)')
      .eq('documents.episode_id', episodeId)

    if (allTranslations && allTranslations.length > 0 && episodeRow) {
      const summaryInput: DocumentSummaryInput[] = allTranslations.map((t) => ({
        plain_language: t.plain_language,
        what_it_means: t.what_it_means,
        document_type: (t.documents as { type?: string } | null)?.type as DocumentSummaryInput['document_type'] ?? 'document',
        document_date: (t.documents as { document_date?: string | null } | null)?.document_date ?? null,
      }))

      const summary = await regenerateEpisodeSummary(
        patientName,
        episodeRow.started_at,
        summaryInput
      )
      await upsertEpisodeSummary(supabase, episodeId, summary)
      log.info('upload', 'episode summary updated', { episodeId })
    }
  } catch (err) {
    // Non-fatal — previous summary is preserved
    log.warn('upload', 'episode summary regeneration failed — keeping previous', {
      episodeId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  revalidatePath(`/dashboard/${episodeId}`)
  log.info('upload', 'pipeline complete', { documentId, episodeId })
  return { ok: true, documentId }
}
