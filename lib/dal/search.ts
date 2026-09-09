import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DOCUMENT_COLUMNS, toSummary, type DocumentRow, type DocumentSummary } from './documents'

const SEARCH_LIMIT = 20

// Searches two independent tsvectors — documents.search_tsv (title,
// doctor_name, facility_name, doc_type) and document_explanations.search_tsv
// (what_it_says, the AI-composed summary) — a family member might remember
// either a printed detail or a phrase from the explanation, not which table
// it lives in. Two separate queries, not one hand-built .or() string: unlike
// lib/dal/timeline.ts's cursor filter (our own generated event_date/id
// values, safe to interpolate), this filter's input is free-text a person
// typed — a comma or paren in it would corrupt a raw PostgREST filter string.
export async function searchDocuments(profileId: string, query: string): Promise<DocumentSummary[]> {
  const supabase = await createClient()

  const [{ data: directRows }, { data: explanationRows }] = await Promise.all([
    supabase
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .eq('profile_id', profileId)
      .textSearch('search_tsv', query, { type: 'websearch', config: 'simple' })
      .order('event_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(SEARCH_LIMIT),
    supabase
      .from('document_explanations')
      .select('document_id, documents!inner(profile_id)')
      .eq('documents.profile_id', profileId)
      .textSearch('search_tsv', query, { type: 'websearch', config: 'simple' })
      .limit(SEARCH_LIMIT),
  ])

  const direct = (directRows as DocumentRow[] | null) ?? []
  const directIds = new Set(direct.map((row) => row.id))
  const explanationDocIds = ((explanationRows as { document_id: string }[] | null) ?? [])
    .map((row) => row.document_id)
    .filter((id) => !directIds.has(id))

  let extra: DocumentRow[] = []
  if (explanationDocIds.length > 0) {
    const { data } = await supabase.from('documents').select(DOCUMENT_COLUMNS).in('id', explanationDocIds)
    extra = (data as DocumentRow[] | null) ?? []
  }

  return [...direct, ...extra]
    .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.id.localeCompare(a.id))
    .slice(0, SEARCH_LIMIT)
    .map(toSummary)
}
