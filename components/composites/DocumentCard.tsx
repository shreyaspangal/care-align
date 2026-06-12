import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { TranslationStatusIndicator } from '@/components/primitives/TranslationStatusIndicator'
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
}

export function DocumentCard({ document, onClick, onRetry }: DocumentCardProps) {
  return (
    // div + role/keyboard so nested retry button stays valid HTML
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="w-full text-left border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <DocumentTypeTag type={document.type} />
        <span className="text-xs text-muted-foreground shrink-0">
          {document.document_date ?? 'Date unknown'}
        </span>
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
