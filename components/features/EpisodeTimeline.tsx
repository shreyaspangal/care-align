'use client'

import { useState } from 'react'
import { DocumentCard } from '@/components/composites/DocumentCard'
import { TranslationOutputPanel, type PanelDocument, type PanelTranslation } from './TranslationOutputPanel'
import type { DocumentStatus, TranslationStatus } from '@/lib/types/domain'
import type { EpisodeDocument } from '@/lib/dal/documents'

export type TimelineDocument = EpisodeDocument

type EpisodeTimelineProps = {
  documents: TimelineDocument[]
  viewerRole: 'coordinator' | 'patient'
}

function toTranslationStatus(status: DocumentStatus): TranslationStatus {
  switch (status) {
    case 'pending_classification': return 'pending'
    case 'classified': return 'translating'
    case 'translated': return 'complete'
    case 'failed': return 'failed'
  }
}

export function EpisodeTimeline({ documents, viewerRole }: EpisodeTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = documents.find((d) => d.id === selectedId) ?? null

  const panelDocument: PanelDocument | null = selected
    ? {
        id: selected.id,
        name: selected.name,
        type: selected.type,
        document_date: selected.document_date,
      }
    : null

  const panelTranslation: PanelTranslation | null = selected?.translation ?? null

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {viewerRole === 'coordinator'
          ? 'No documents yet — upload the first one above.'
          : 'No documents yet. Your coordinator will upload them shortly.'}
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={{
              id: doc.id,
              name: doc.name,
              type: doc.type,
              purpose: doc.purpose,
              document_date: doc.document_date,
              translation_status: toTranslationStatus(doc.status),
            }}
            onClick={() => setSelectedId(doc.id)}
          />
        ))}
      </div>

      {panelDocument && (
        <TranslationOutputPanel
          open={selectedId !== null}
          onClose={() => setSelectedId(null)}
          document={panelDocument}
          translation={panelTranslation}
          viewerRole={viewerRole}
        />
      )}
    </>
  )
}
