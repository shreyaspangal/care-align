'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DocumentCard } from '@/components/composites/DocumentCard'
import { TranslationOutputPanel, type PanelDocument, type PanelTranslation } from './TranslationOutputPanel'
import type { DocumentStatus, TranslationStatus } from '@/lib/types/domain'
import type { EpisodeDocument } from '@/lib/dal/documents'

export type TimelineDocument = EpisodeDocument

type EpisodeTimelineProps = {
  documents: TimelineDocument[]
  viewerRole: 'coordinator' | 'patient'
  onDelete?: (documentId: string) => Promise<{ ok: boolean; error?: string }>
}

function toTranslationStatus(status: DocumentStatus): TranslationStatus {
  switch (status) {
    case 'pending_classification': return 'pending'
    case 'classified': return 'translating'
    case 'translated': return 'complete'
    case 'failed': return 'failed'
  }
}

export function EpisodeTimeline({ documents, viewerRole, onDelete }: EpisodeTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleDocuments = viewerRole === 'patient'
    ? documents.filter(d => d.status === 'translated')
    : documents

  const selected = visibleDocuments.find((d) => d.id === selectedId) ?? null

  const panelDocument: PanelDocument | null = selected
    ? {
        id: selected.id,
        name: selected.name,
        type: selected.type,
        document_date: selected.document_date,
        source_hospital: selected.source_hospital,
        status: selected.status,
      }
    : null

  const panelTranslation: PanelTranslation | null = selected?.translation ?? null

  if (visibleDocuments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {viewerRole === 'coordinator'
          ? 'No documents yet — get started by uploading the first one above.'
          : 'No documents have been processed yet. Your coordinator is working on it.'}
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visibleDocuments.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={{
              id: doc.id,
              name: doc.name,
              type: doc.type,
              purpose: doc.purpose,
              document_date: doc.document_date,
              uploaded_at: doc.created_at,
              translation_status: toTranslationStatus(doc.status),
            }}
            onClick={() => setSelectedId(doc.id)}
            onDelete={onDelete ? async () => {
              const result = await onDelete(doc.id)
              if (!result.ok) toast.error(result.error ?? 'Failed to delete document.')
            } : undefined}
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
