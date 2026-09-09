import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DocumentStatus, DocType, Term, Medication, LabTest } from '@/lib/types/domain'

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
  eventDate: string
}

// Exported for lib/dal/search.ts, which needs the same row shape when
// fetching explanation-matched documents by id — one shared definition
// rather than a third hand-copied version (timeline.ts already has its own).
export const DOCUMENT_COLUMNS =
  'id, status, doc_type, title, title_is_guessed, document_date, doctor_name, facility_name, captured_at, event_date'

export type DocumentRow = {
  id: string
  status: DocumentStatus
  doc_type: DocType | null
  title: string | null
  title_is_guessed: boolean
  document_date: string | null
  doctor_name: string | null
  facility_name: string | null
  captured_at: string
  event_date: string
}

export function toSummary(row: DocumentRow): DocumentSummary {
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
    eventDate: row.event_date,
  }
}

// event_date (generated column, supabase/migrations/20260908000002) =
// document_date when known, else the IST capture day — the coalesce
// documents_timeline_idx's own comment always intended, now a real column
// so it can be ordered on directly (Rule 2's verbatim-or-null document_date
// stays untouched; event_date is purely a display/ordering derivative).
// id is the tiebreaker for two documents landing on the same event_date.
export const getDocuments = cache(async (profileId: string): Promise<DocumentSummary[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('profile_id', profileId)
    .order('event_date', { ascending: false })
    .order('id', { ascending: false })
  return (data ?? []).map(toSummary)
})

export type DocumentFile = {
  blobKey: string
  mimeType: string
}

// blob_key is deliberately excluded from DocumentSummary (Hard Rule 7 — no
// raw storage paths reach the client). This is the one place a caller may
// read it, to mint a short-lived signed URL from it server-side.
export const getDocumentFile = cache(async (documentId: string): Promise<DocumentFile | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('blob_key, mime_type')
    .eq('id', documentId)
    .maybeSingle()
  return data ? { blobKey: data.blob_key, mimeType: data.mime_type } : null
})

export type DocumentExplanation = {
  whatItSays: string
  terms: Term[]
  medications: Medication[]
  tests: LabTest[]
}

export type DocumentDetail = DocumentSummary & {
  profileId: string
  patientNameAsWritten: string | null
  // null until organize() has run once (status='uploaded'), or if it never
  // produced one (status='needs_review' before a first successful run).
  explanation: DocumentExplanation | null
}

const DOCUMENT_DETAIL_COLUMNS = `${DOCUMENT_COLUMNS}, profile_id, patient_name_as_written`

type DocumentDetailRow = DocumentRow & { profile_id: string; patient_name_as_written: string | null }

type ExplanationRow = {
  what_it_says: string
  terms: Term[]
  medications_as_written: Medication[]
  tests_as_written: LabTest[]
}

export const getDocumentDetail = cache(
  async (documentId: string): Promise<DocumentDetail | null> => {
    const supabase = await createClient()
    const [{ data: doc }, { data: explanation }] = await Promise.all([
      supabase
        .from('documents')
        .select(DOCUMENT_DETAIL_COLUMNS)
        .eq('id', documentId)
        .maybeSingle<DocumentDetailRow>(),
      supabase
        .from('document_explanations')
        .select('what_it_says, terms, medications_as_written, tests_as_written')
        .eq('document_id', documentId)
        .maybeSingle<ExplanationRow>(),
    ])
    if (!doc) return null
    return {
      ...toSummary(doc),
      profileId: doc.profile_id,
      patientNameAsWritten: doc.patient_name_as_written,
      explanation: explanation
        ? {
            whatItSays: explanation.what_it_says,
            terms: explanation.terms,
            medications: explanation.medications_as_written,
            tests: explanation.tests_as_written,
          }
        : null,
    }
  }
)
