'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DeleteDocumentSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('deleteDocument')

export type DeleteDocumentResult = { ok: true } | { ok: false; error: string }

export async function deleteDocument(documentId: string): Promise<DeleteDocumentResult> {
  const parsed = DeleteDocumentSchema.safeParse({ documentId })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Fetch document to verify coordinator access via episode → patient
  const { data: doc } = await supabase
    .from('documents')
    .select('id, episode_id, episodes(patient_id)')
    .eq('id', parsed.data.documentId)
    .is('deleted_at', null)
    .single()

  if (!doc) return { ok: false, error: 'Document not found.' }

  const patientId = (doc.episodes as { patient_id?: string } | null)?.patient_id

  if (patientId) {
    const { data: access } = await supabase
      .from('patient_access')
      .select('role')
      .eq('user_id', user.id)
      .eq('patient_id', patientId)
      .single()

    if (!access || access.role !== 'coordinator') {
      return { ok: false, error: 'Not authorised to delete this document.' }
    }
  }

  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', parsed.data.documentId)

  if (error) {
    log.error('deleteDocument', 'update failed', { documentId, error: error.message })
    return { ok: false, error: 'Failed to delete document. Please try again.' }
  }

  log.info('deleteDocument', 'document deleted', { documentId })

  if (patientId) {
    revalidatePath(`/dashboard/${patientId}`)
    revalidatePath(`/dashboard/${patientId}/tasks`)
  }

  return { ok: true }
}
