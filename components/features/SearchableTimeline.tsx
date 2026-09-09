'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { DocumentCard } from './DocumentCard'
import { TimelineList } from './TimelineList'
import type { TimelineItem, TimelineCursor } from '@/lib/dal/timeline'
import type { LoadMoreTimelineResult } from '@/actions/timeline'
import type { SearchResult } from '@/actions/search'
import type { DocumentActionResult } from '@/actions/documents'
import type { DocumentSummary } from '@/lib/dal/documents'
import type { DOC_TYPES } from '@/lib/types/domain'

const SEARCH_DEBOUNCE_MS = 300

type UpdateDocumentDetails = (input: {
  documentId: string
  docType: (typeof DOC_TYPES)[number]
  title: string
  documentDate: string | null
  doctorName: string | null
  facilityName: string | null
}) => Promise<DocumentActionResult>

type SearchableTimelineProps = {
  profileId: string
  initialItems: TimelineItem[]
  initialCursor: TimelineCursor | null
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  loadMoreTimelineItems: (
    profileId: string,
    cursor: TimelineCursor | null
  ) => Promise<LoadMoreTimelineResult>
  retryOrganize: (documentId: string) => Promise<DocumentActionResult>
  updateDocumentDetails: UpdateDocumentDetails
  searchDocuments: (input: { profileId: string; query: string }) => Promise<SearchResult>
}

// Owns the query box and switches between live search results and the
// normal paginated timeline — merged into one client component (rather than
// two siblings) so a search in progress can actually replace the timeline
// instead of both rendering at once (CLAUDE.md Hard Rule 9: actions are
// injected here once, from the RSC page, not imported by either child).
export function SearchableTimeline({
  profileId,
  initialItems,
  initialCursor,
  loadMoreTimelineItems,
  retryOrganize,
  updateDocumentDetails,
  searchDocuments,
}: SearchableTimelineProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<DocumentSummary[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    // Nothing to fetch for an empty query — stale `results` from a previous
    // query is harmless, since the JSX below only reads it while
    // `debouncedQuery` is truthy.
    if (!debouncedQuery) return

    let cancelled = false
    async function run() {
      setIsSearching(true)
      const result = await searchDocuments({ profileId, query: debouncedQuery })
      if (cancelled) return
      setIsSearching(false)
      setResults(result.success ? result.items : [])
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, profileId, searchDocuments])

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        placeholder="Search by title, doctor, facility…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search documents"
      />
      {debouncedQuery ? (
        <SearchResults
          query={debouncedQuery}
          isSearching={isSearching}
          results={results}
          profileId={profileId}
          retryOrganize={retryOrganize}
          updateDocumentDetails={updateDocumentDetails}
        />
      ) : initialItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet — capture the first one above.</p>
      ) : (
        <TimelineList
          profileId={profileId}
          initialItems={initialItems}
          initialCursor={initialCursor}
          loadMoreTimelineItems={loadMoreTimelineItems}
          retryOrganize={retryOrganize}
          updateDocumentDetails={updateDocumentDetails}
        />
      )}
    </div>
  )
}

function SearchResults({
  query,
  isSearching,
  results,
  profileId,
  retryOrganize,
  updateDocumentDetails,
}: {
  query: string
  isSearching: boolean
  results: DocumentSummary[] | null
  profileId: string
  retryOrganize: (documentId: string) => Promise<DocumentActionResult>
  updateDocumentDetails: UpdateDocumentDetails
}) {
  if (isSearching) {
    return <p className="text-sm text-muted-foreground">Searching…</p>
  }
  if (!results || results.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents match &quot;{query}&quot;.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {results.map((document) => (
        <DocumentCard
          key={`search-${document.id}`}
          document={document}
          profileId={profileId}
          retryOrganize={retryOrganize}
          updateDocumentDetails={updateDocumentDetails}
        />
      ))}
    </div>
  )
}
