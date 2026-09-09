'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentCard } from './DocumentCard'
import type { TimelineItem, TimelineCursor } from '@/lib/dal/timeline'
import type { LoadMoreTimelineResult } from '@/actions/timeline'
import type { DocumentActionResult } from '@/actions/documents'
import type { DOC_TYPES } from '@/lib/types/domain'

type TimelineListProps = {
  profileId: string
  initialItems: TimelineItem[]
  initialCursor: TimelineCursor | null
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  loadMoreTimelineItems: (
    profileId: string,
    cursor: TimelineCursor | null
  ) => Promise<LoadMoreTimelineResult>
  retryOrganize: (documentId: string) => Promise<DocumentActionResult>
  updateDocumentDetails: (input: {
    documentId: string
    docType: (typeof DOC_TYPES)[number]
    title: string
    documentDate: string | null
    doctorName: string | null
    facilityName: string | null
  }) => Promise<DocumentActionResult>
}

function TimelineSkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-2 h-5 w-2/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
}

export function TimelineList({
  profileId,
  initialItems,
  initialCursor,
  loadMoreTimelineItems,
  retryOrganize,
  updateDocumentDetails,
}: TimelineListProps) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [isLoading, setIsLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ isLoading, cursor })
  useEffect(() => {
    stateRef.current = { isLoading, cursor }
  }, [isLoading, cursor])

  async function loadMore() {
    if (!cursor) return
    setIsLoading(true)
    const result = await loadMoreTimelineItems(profileId, cursor)
    if (result.success) {
      setItems((prev) => [...prev, ...result.page.items])
      setCursor(result.page.nextCursor)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !cursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !stateRef.current.isLoading && stateRef.current.cursor) {
          void loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore is stable across renders in effect, stateRef avoids stale closures
  }, [cursor])

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <DocumentCard
          key={`document-${item.id}`}
          document={item.document}
          profileId={profileId}
          retryOrganize={retryOrganize}
          updateDocumentDetails={updateDocumentDetails}
        />
      ))}
      {isLoading && <TimelineSkeletonCard />}
      {/* aspect-ratio-reserved-adjacent: a fixed-height sentinel, not a
          zero-height div, so scroll position doesn't jump when it's
          replaced by real content (BUILD_PLAN Phase 3 item 1). */}
      {cursor && <div ref={sentinelRef} className="h-4" aria-hidden />}
    </div>
  )
}
