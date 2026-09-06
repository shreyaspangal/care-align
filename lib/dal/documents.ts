import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DocumentStatus, DocType } from '@/lib/types/domain'

export type DocumentSummary = {
  id: string
  status: DocumentStatus
  docType: DocType | null
  title: string | null
  titleIsGuessed: boolean
  documentDate: string | null
  doctorName: string | null
  facilityName: string | null
  capturedAt: string
}

const DOCUMENT_COLUMNS =
  'id, status, doc_type, title, title_is_guessed, document_date, doctor_name, facility_name, captured_at'

type DocumentRow = {
  id: string
  status: DocumentStatus
  doc_type: DocType | null
  title: string | null
  title_is_guessed: boolean
  document_date: string | null
  doctor_name: string | null
  facility_name: string | null
  captured_at: string
}

function toSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    status: row.status,
    docType: row.doc_type,
    title: row.title,
    titleIsGuessed: row.title_is_guessed,
    documentDate: row.document_date,
    doctorName: row.doctor_name,
    facilityName: row.facility_name,
    capturedAt: row.captured_at,
  }
}

// Ordered by capture time for now (newest upload on top) — the exact
// event-date timeline ordering (documents_timeline_idx, coalescing
// document_date with the IST capture day) is Phase 3's job, alongside
// keyset pagination. Every row still belongs to one profile, so this is
// correct for Phase 2's "did my capture land and organize" purpose.
export const getDocuments = cache(async (profileId: string): Promise<DocumentSummary[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('profile_id', profileId)
    .order('captured_at', { ascending: false })
  return (data ?? []).map(toSummary)
})
