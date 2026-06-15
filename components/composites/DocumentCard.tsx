import { Trash2 } from 'lucide-react'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'
import { Button } from '@/components/ui/button'
import type { DocumentType, TranslationStatus } from '@/lib/types/domain'

type DocumentCardProps = {
  document: {
    id: string
    name: string
    type: DocumentType
    purpose: string | null
    document_date: string | null
    translation_status: TranslationStatus
  }
  onClick?: () => void
  onRetry?: () => void
  onDelete?: () => void
}

export function DocumentCard({ document, onClick, onRetry, onDelete }: DocumentCardProps) {
  return (
    // div + role/keyboard so nested action buttons stay valid HTML
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="w-full text-left border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <DocumentTypeTag type={document.type} />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">
            {document.document_date ?? 'Date unknown'}
          </span>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              aria-label="Delete document"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-foreground leading-snug mb-1">
        {document.name}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {document.purpose ?? 'Processing...'}
        </span>
        <TranslationStatusIndicator
          status={document.translation_status}
          onRetry={document.translation_status === 'failed' ? onRetry : undefined}
        />
      </div>
    </div>
  )
}
