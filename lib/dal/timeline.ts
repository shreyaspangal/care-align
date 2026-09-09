import 'server-only'

import * as z from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { DocumentSummary } from './documents'

// Keyset-paginated timeline for one profile (Phase 3 item 1,
// docs/BUILD_PLAN.md). Documents-only for now — BUILD_PLAN's own spec calls
// for "documents ∪ appointments," but a manual add-appointment form asks a
// family to retype something they already have in a calendar app or a
// clinic's own WhatsApp reminder, with no reminder-sending payoff to justify
// the new habit (this project's own docs/DESIGN_REVIEW_LENS.md: "old habits
// beat better products"). Deferred until there's a real story for how an
// appointment gets in here without manual re-entry — most plausibly
// extracted from a captured document's own follow-up date, the same way
// organize() already extracts dates verbatim. Revisit before Phase 4.

const PAGE_SIZE = 20

export type TimelineItem = { kind: 'document'; id: string; eventDate: string; document: DocumentSummary }

const TimelineCursorSchema = z.object({
  eventDate: z.iso.date(),
  id: z.uuid(),
})
export type TimelineCursor = z.infer<typeof TimelineCursorSchema>

export type TimelinePage = {
  items: TimelineItem[]
  nextCursor: TimelineCursor | null
}

const DOCUMENT_COLUMNS =
  'id, status, doc_type, title, title_is_guessed, document_date, doctor_name, facility_name, captured_at, event_date'

type DocumentPageRow = {
  id: string
  status: DocumentSummary['status']
  doc_type: DocumentSummary['docType']
  title: string | null
  title_is_guessed: boolean
  document_date: string | null
  doctor_name: string | null
  facility_name: string | null
  captured_at: string
  event_date: string
}

function toDocumentSummary(row: DocumentPageRow): DocumentSummary {
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

// event_date/id are our own generated cursor values, never raw
// client-controlled strings — validated regardless, since this builds a raw
// PostgREST .or() filter string and a malformed value there is a
// filter-injection risk, not just a type error.
function beforeCursorFilter(cursor: TimelineCursor): string {
  const safe = TimelineCursorSchema.parse(cursor)
  return `event_date.lt.${safe.eventDate},and(event_date.eq.${safe.eventDate},id.lt.${safe.id})`
}

export async function getTimelinePage(
  profileId: string,
  cursor: TimelineCursor | null
): Promise<TimelinePage> {
  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('profile_id', profileId)
    .order('event_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE)

  if (cursor) {
    query = query.or(beforeCursorFilter(cursor))
  }

  const { data } = await query
  const rows = (data as DocumentPageRow[] | null) ?? []

  const items: TimelineItem[] = rows.map((row) => ({
    kind: 'document' as const,
    id: row.id,
    eventDate: row.event_date,
    document: toDocumentSummary(row),
  }))

  const last = items[items.length - 1]
  const nextCursor = last && rows.length === PAGE_SIZE ? { eventDate: last.eventDate, id: last.id } : null

  return { items, nextCursor }
}
