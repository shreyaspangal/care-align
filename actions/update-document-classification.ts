'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DOCUMENT_TYPES, type DocumentType } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('updateDocumentClassification')

const UpdateClassificationSchema = z.object({
  type: z.enum([...DOCUMENT_TYPES] as [DocumentType, ...DocumentType[]]),
  purpose: z.string().trim().max(500).nullable(),
  source_hospital: z.string().trim().max(200).nullable(),
  source_department: z.string().trim().max(200).nullable(),
  document_date: z.string().nullable(),
})

export type UpdateClassificationResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateDocumentClassification(
  documentId: string,
  fields: unknown
): Promise<UpdateClassificationResult> {
  const parsed = UpdateClassificationSchema.safeParse(fields)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid classification data.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // RLS enforces coordinator-only access — the update will return 0 rows
  // if the user does not have coordinator access to this document's episode.
  const { data, error } = await supabase
    .from('documents')
    .update({
      type: parsed.data.type,
      purpose: parsed.data.purpose,
      source_hospital: parsed.data.source_hospital,
      source_department: parsed.data.source_department,
      document_date: parsed.data.document_date,
    })
    .eq('id', documentId)
    .select('episode_id')
    .single()

  if (error || !data) {
    log.error('update-classification', 'update failed', {
      documentId,
      error: error?.message,
    })
    return { ok: false, error: 'Failed to save changes.' }
  }

  log.info('update-classification', 'classification updated by coordinator', { documentId })
  revalidatePath(`/dashboard/${data.episode_id}`)
  return { ok: true }
}
