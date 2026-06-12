'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import type { DocumentType, TaskCategory, ActionFor, TaskPhase, UserRole } from '@/lib/types/domain'

export type PanelAction = {
  id: string
  description: string
  category: TaskCategory
  action_for: ActionFor
  phase_appears: TaskPhase
}

export type PanelTranslation = {
  plain_language: string
  what_it_means: string
  actions: PanelAction[]
}

export type PanelDocument = {
  id: string
  name: string
  type: DocumentType
  document_date: string | null
}

type TranslationOutputPanelProps = {
  open: boolean
  onClose: () => void
  document: PanelDocument
  translation: PanelTranslation | null
  viewerRole: UserRole
}

export function TranslationOutputPanel({
  open,
  onClose,
  document,
  translation,
  viewerRole,
}: TranslationOutputPanelProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <DocumentTypeTag type={document.type} />
            {document.document_date && (
              <span className="text-xs text-muted-foreground">{document.document_date}</span>
            )}
          </div>
          <SheetTitle className="text-base leading-snug">{document.name}</SheetTitle>
        </SheetHeader>

        {!translation ? (
          <div className="mt-6 space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <section className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                What this document says
              </p>
              <p className="text-sm leading-relaxed">{translation.plain_language}</p>
            </section>

            <section className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                What this means
              </p>
              <p className="text-sm leading-relaxed">{translation.what_it_means}</p>
            </section>

            {viewerRole === 'coordinator' && translation.actions.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Actions required
                  </p>
                  <ul className="space-y-2">
                    {translation.actions.map((action) => (
                      <li key={action.id} className="flex items-start gap-2.5 text-sm">
                        <TaskCategoryIcon category={action.category} size={15} />
                        <span className="leading-snug">{action.description}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
