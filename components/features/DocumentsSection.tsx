'use client'

import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { EpisodeTimeline } from '@/components/features/EpisodeTimeline'
import type { EpisodeDocument } from '@/lib/dal/documents'

type SortKey = 'newest' | 'oldest' | 'type'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'type',   label: 'By type' },
]

type DocumentsSectionProps = {
  documents: EpisodeDocument[]
  onDelete?: (documentId: string) => Promise<{ ok: boolean; error?: string }>
}

export function DocumentsSection({ documents, onDelete }: DocumentsSectionProps) {
  const [sort, setSort] = useState<SortKey>('newest')

  const sorted = useMemo(() => {
    const copy = [...documents]
    if (sort === 'newest') return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (sort === 'oldest') return copy.sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (sort === 'type')   return copy.sort((a, b) => a.type.localeCompare(b.type))
    return copy
  }, [documents, sort])

  if (documents.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Section heading + sort */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Uploaded documents
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({documents.length})
          </span>
        </p>

        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="h-7 rounded-md border border-input bg-background pl-2.5 pr-6 text-xs text-muted-foreground appearance-none cursor-pointer hover:border-brand-border hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 text-muted-foreground" size={12} />
        </div>
      </div>

      {/* Document list */}
      <EpisodeTimeline
        documents={sorted}
        viewerRole="coordinator"
        onDelete={onDelete}
      />
    </div>
  )
}
