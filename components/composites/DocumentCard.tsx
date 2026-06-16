'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { DocumentType, TranslationStatus } from '@/lib/types/domain'

type DocumentCardProps = {
  document: {
    id: string
    name: string
    type: DocumentType
    purpose: string | null
    document_date: string | null
    uploaded_at?: string
    translation_status: TranslationStatus
  }
  onClick?: () => void
  onRetry?: () => void
  onDelete?: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatUploadedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export function DocumentCard({ document, onClick, onRetry, onDelete }: DocumentCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        className="w-full text-left border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer space-y-2"
      >
        {/* Row 1: title + type tag + delete */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground leading-snug flex-1 min-w-0">
            {document.name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <DocumentTypeTag type={document.type} />
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
                aria-label="Delete document"
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: description */}
        <p className="text-xs text-muted-foreground">
          {document.purpose ?? 'Processing...'}
        </p>

        {/* Row 3: issued at · uploaded on + translation status */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {document.document_date
              ? <>Issued at: {formatDate(document.document_date)}</>
              : <>Issued at: <span className="italic">Unknown</span></>
            }
            {document.uploaded_at && (
              <> · Uploaded on: {formatUploadedAt(document.uploaded_at)}</>
            )}
          </p>
          <TranslationStatusIndicator
            status={document.translation_status}
            onRetry={document.translation_status === 'failed' ? onRetry : undefined}
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              This will permanently remove the document and its translation. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { onDelete?.(); setConfirmOpen(false) }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
