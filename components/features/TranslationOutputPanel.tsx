'use client'

import { AlertCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { TaskCategoryIcon } from '@/components/primitives/TaskCategoryIcon'
import type { DocumentType, DocumentStatus, TaskCategory, ActionFor, TaskPhase, UserRole } from '@/lib/types/domain'

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
  source_hospital: string | null
  status: DocumentStatus
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
  const coordinatorActions = translation?.actions.filter(a => a.action_for === 'coordinator') ?? []
  const patientActions     = translation?.actions.filter(a => a.action_for === 'patient') ?? []
  const hasActions         = coordinatorActions.length > 0 || patientActions.length > 0

  const formattedDate = document.document_date
    ? new Date(document.document_date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0">

        {/* ── Header ── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <DocumentTypeTag type={document.type} />
            {formattedDate && (
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
            )}
          </div>
          <SheetTitle className="text-base leading-snug font-semibold">
            {document.name}
          </SheetTitle>
          {document.source_hospital && (
            <p className="text-xs text-muted-foreground">{document.source_hospital}</p>
          )}
        </SheetHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Failed state */}
          {document.status === 'failed' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle size={18} className="text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Could not process this document</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                  The document was unclear or in an unsupported format. Try uploading a clearer scan or a different version.
                </p>
              </div>
            </div>
          )}

          {/* Pending / classifying state */}
          {(document.status === 'pending_classification' || document.status === 'classified') && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <div className="h-3 bg-muted rounded-full animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded-full animate-pulse w-full" />
                <div className="h-3 bg-muted rounded-full animate-pulse w-5/6" />
                <div className="h-3 bg-muted rounded-full animate-pulse w-2/3" />
              </div>
              <p className="text-xs text-muted-foreground text-center pt-1">
                {document.status === 'pending_classification' ? 'Reading document…' : 'Translating…'}
              </p>
            </div>
          )}

          {/* Translated state */}
          {document.status === 'translated' && translation && (
            <>
              {/* Plain language */}
              <section className="space-y-2">
                <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  What this document says
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {translation.plain_language}
                </p>
              </section>

              {/* What it means */}
              <section className="rounded-xl bg-brand-tint/50 border border-brand-border/30 px-4 py-3.5 space-y-2">
                <p className="text-2xs font-semibold uppercase tracking-widest text-brand-base">
                  What this means for you
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {translation.what_it_means}
                </p>
              </section>

              {/* Actions — coordinator only */}
              {viewerRole === 'coordinator' && hasActions && (
                <>
                  <Separator />
                  <section className="space-y-4">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Actions required
                    </p>

                    {coordinatorActions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-2xs text-muted-foreground/70 uppercase tracking-widest font-medium">
                          Coordinator
                        </p>
                        <ul className="space-y-2">
                          {coordinatorActions.map(action => (
                            <li key={action.id} className="flex items-start gap-2.5">
                              <TaskCategoryIcon category={action.category} size={14} />
                              <span className="text-sm leading-snug text-foreground">{action.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {patientActions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-2xs text-muted-foreground/70 uppercase tracking-widest font-medium">
                          Patient
                        </p>
                        <ul className="space-y-2">
                          {patientActions.map(action => (
                            <li key={action.id} className="flex items-start gap-2.5">
                              <TaskCategoryIcon category={action.category} size={14} />
                              <span className="text-sm leading-snug text-foreground">{action.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Patient-facing actions — patient view only */}
              {viewerRole === 'patient' && patientActions.length > 0 && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                      What you need to do
                    </p>
                    <ul className="space-y-2">
                      {patientActions.map(action => (
                        <li key={action.id} className="flex items-start gap-2.5">
                          <TaskCategoryIcon category={action.category} size={14} />
                          <span className="text-sm leading-snug text-foreground">{action.description}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
