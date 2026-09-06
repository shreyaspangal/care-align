import 'server-only'

import { generateText, Output, NoOutputGeneratedError } from 'ai'
import { createServiceClient } from '@/lib/supabase/service'
import { model, activeModelId } from '@/lib/ai/models'
import { ORGANIZE_SYSTEM_PROMPT, ORGANIZE_PROMPT_VERSION } from '@/lib/ai/organize-prompt'
import { OrganizeSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai:organize')

// Runs inside after() (Hard Rule 6) — no request-scoped cookies are
// guaranteed to survive into that callback, so this uses the service client
// throughout. Safe here specifically because every write is keyed to a
// documentId that was already resolved to the correct family during the
// synchronous part of the request (createDocument) — this function trusts
// that resolution rather than re-deriving it from a session.
export async function organizeDocument(documentId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, family_id, blob_key, mime_type')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) {
    log.error('organizeDocument', 'document not found', { documentId })
    return
  }

  // Capture is sacred (Hard Rule 3): every failure path below marks
  // needs_review and returns — the document stays visible either way, it
  // just picks up a manual-fix affordance instead of AI-extracted fields.
  const markNeedsReview = async () => {
    const { error } = await supabase
      .from('documents')
      .update({ status: 'needs_review' })
      .eq('id', documentId)
    if (error) {
      log.error('organizeDocument', 'needs_review update failed', {
        documentId,
        error: error.message,
      })
    }
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('documents')
    .download(doc.blob_key)
  if (downloadError || !fileBlob) {
    log.error('organizeDocument', 'download failed', {
      documentId,
      error: downloadError?.message,
    })
    await markNeedsReview()
    return
  }

  const bytes = new Uint8Array(await fileBlob.arrayBuffer())
  const mimeType = doc.mime_type
  const startedAt = Date.now()

  async function runOrganize() {
    return generateText({
      model: model('organize'),
      system: ORGANIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user' as const,
          content: [{ type: 'file' as const, data: bytes, mediaType: mimeType }],
        },
      ],
      output: Output.object({ schema: OrganizeSchema }),
    })
  }

  let result: Awaited<ReturnType<typeof runOrganize>>
  try {
    result = await runOrganize()
  } catch (err) {
    const reason = NoOutputGeneratedError.isInstance(err)
      ? 'model did not produce valid structured output'
      : err instanceof Error
        ? err.message
        : String(err)
    log.error('organizeDocument', 'generateText failed', { documentId, error: reason })
    await markNeedsReview()
    return
  }

  const latencyMs = Date.now() - startedAt

  // Provider-independent safety net (research-confirmed, D-004): the AI SDK
  // core just forwards the schema request to the provider — only Anthropic's
  // own provider guarantees enforcement (it forces a tool call internally).
  // For any other provider (the dev-tier free OpenRouter model), a field can
  // go silently missing from an otherwise valid-shaped object with no error —
  // that can't be caught by re-validating against the SAME schema (a missing
  // nullable field just looks like null). What we CAN catch: warnings the
  // provider does surface, and outright schema violations Output.object's
  // internal check might miss if a provider mutates the shape unexpectedly.
  if (result.warnings?.length) {
    log.warn('organizeDocument', 'model call returned warnings', {
      documentId,
      model: activeModelId('organize'),
      warnings: result.warnings,
    })
  }

  const validated = OrganizeSchema.safeParse(result.output)
  if (!validated.success) {
    log.error('organizeDocument', 'output failed schema validation', {
      documentId,
      issues: validated.error.issues,
    })
    await markNeedsReview()
    return
  }
  const parsed = validated.data

  const { error: documentsError } = await supabase
    .from('documents')
    .update({
      status: parsed.readable ? 'organized' : 'needs_review',
      doc_type: parsed.doc_type,
      title: parsed.title,
      title_is_guessed: parsed.title_is_guessed,
      document_date: parsed.document_date,
      doctor_name: parsed.doctor_name,
      facility_name: parsed.facility_name,
    })
    .eq('id', documentId)
  if (documentsError) {
    log.error('organizeDocument', 'documents update failed', {
      documentId,
      error: documentsError.message,
    })
    await markNeedsReview()
    return
  }

  // One row per document — a future retry overwrites via this same upsert.
  const { error: explanationError } = await supabase.from('document_explanations').upsert(
    {
      family_id: doc.family_id,
      document_id: documentId,
      prompt_version: ORGANIZE_PROMPT_VERSION,
      model: activeModelId('organize'),
      what_it_says: parsed.what_it_says,
      terms: parsed.terms,
      medications_as_written: parsed.medications_as_written,
      tests_as_written: parsed.tests_as_written,
      latency_ms: latencyMs,
      input_tokens: result.usage.inputTokens ?? null,
      output_tokens: result.usage.outputTokens ?? null,
    },
    { onConflict: 'document_id' }
  )
  if (explanationError) {
    log.error('organizeDocument', 'document_explanations upsert failed', {
      documentId,
      error: explanationError.message,
    })
    await markNeedsReview()
  }
}
