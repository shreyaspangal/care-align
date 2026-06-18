import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DocumentType, DocumentStatus, TaskCategory, ActionFor, TaskPhase } from '@/lib/types/domain'

export type DocumentAction = {
  id: string
  description: string
  category: TaskCategory
  action_for: ActionFor
  phase_appears: TaskPhase
}

export type DocumentTranslation = {
  plain_language: string
  what_it_means: string
  actions: DocumentAction[]
}

export type EpisodeDocument = {
  id: string
  name: string
  type: DocumentType
  purpose: string | null
  document_date: string | null
  source_hospital: string | null
  created_at: string
  status: DocumentStatus
  translation: DocumentTranslation | null
}

export type PatientAction = {
  id: string
  description: string
  category: TaskCategory
  documentName: string
}

/**
 * Returns all patient-facing actions across all translated documents in an episode.
 * Used in the patient Summary tab to show "What you need to do."
 */
export const getPatientActions = cache(async (episodeId: string): Promise<PatientAction[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select(`
      name,
      document_translations (
        document_actions ( id, description, category, action_for )
      )
    `)
    .eq('episode_id', episodeId)
    .eq('status', 'translated')
    .is('deleted_at', null)

  if (!data) return []

  const actions: PatientAction[] = []
  for (const doc of data) {
    const t = Array.isArray(doc.document_translations)
      ? doc.document_translations[0]
      : doc.document_translations
    if (!t) continue
    const acts = Array.isArray(t.document_actions) ? t.document_actions : []
    for (const a of acts) {
      if (a.action_for === 'patient') {
        actions.push({
          id: a.id,
          description: a.description,
          category: a.category as TaskCategory,
          documentName: doc.name,
        })
      }
    }
  }
  return actions
})

/**
 * Returns all non-deleted documents for an episode, sorted chronologically
 * (documents with a known date first, nulls last, then by upload time).
 * Each document includes its translation and extracted actions if available.
 */
export const getEpisodeDocuments = cache(async (episodeId: string): Promise<EpisodeDocument[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select(`
      id, name, type, purpose, document_date, source_hospital, created_at, status,
      document_translations (
        plain_language, what_it_means,
        document_actions ( id, description, category, action_for, phase_appears )
      )
    `)
    .eq('episode_id', episodeId)
    .is('deleted_at', null)
    .order('document_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (!data) return []

  return data.map((doc) => {
    const t = Array.isArray(doc.document_translations)
      ? doc.document_translations[0]
      : doc.document_translations

    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      purpose: doc.purpose,
      document_date: doc.document_date,
      source_hospital: doc.source_hospital ?? null,
      created_at: doc.created_at,
      status: doc.status,
      translation: t
        ? {
            plain_language: t.plain_language,
            what_it_means: t.what_it_means,
            actions: (Array.isArray(t.document_actions) ? t.document_actions : []).map((a) => ({
              id: a.id,
              description: a.description,
              category: a.category,
              action_for: a.action_for,
              phase_appears: a.phase_appears,
            })),
          }
        : null,
    }
  })
})
