'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentTypeTag } from '@/components/primitives/DocumentTypeTag'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/validation/schemas'
import type { DocumentType } from '@/lib/types/domain'
import {
  updateDocumentClassification,
  type ClassificationFields,
} from '@/actions/update-document-classification'

type Props = {
  documentId: string
  current: ClassificationFields
  onSaved?: (updated: ClassificationFields) => void
}

export function DocumentClassificationEditor({ documentId, current, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [fields, setFields] = useState<ClassificationFields>(current)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleEdit() {
    setFields(current)
    setError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    setFields(current)
    setError(null)
    setIsEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateDocumentClassification(documentId, fields)
      if (result.ok) {
        onSaved?.(fields)
        setIsEditing(false)
      } else {
        setError(result.error)
      }
    })
  }

  if (!isEditing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <DocumentTypeTag type={current.type} />
          {current.purpose && (
            <p className="text-xs text-muted-foreground truncate">{current.purpose}</p>
          )}
          {current.source_hospital && (
            <p className="text-xs text-muted-foreground truncate">{current.source_hospital}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleEdit}
          aria-label="Edit classification"
        >
          <Pencil size={13} />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">Edit classification</p>

      {/* Type */}
      <div className="space-y-1">
        <Label className="text-xs">Document type</Label>
        <select
          value={fields.type}
          onChange={e => setFields(f => ({ ...f, type: e.target.value as DocumentType }))}
          className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DOCUMENT_TYPES.map(t => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Purpose */}
      <div className="space-y-1">
        <Label className="text-xs">Purpose</Label>
        <Input
          value={fields.purpose ?? ''}
          onChange={e => setFields(f => ({ ...f, purpose: e.target.value || null }))}
          placeholder="e.g. Pre-operation blood work"
          className="h-8 text-xs"
        />
      </div>

      {/* Hospital */}
      <div className="space-y-1">
        <Label className="text-xs">Hospital</Label>
        <Input
          value={fields.source_hospital ?? ''}
          onChange={e => setFields(f => ({ ...f, source_hospital: e.target.value || null }))}
          placeholder="e.g. Apollo Hospitals"
          className="h-8 text-xs"
        />
      </div>

      {/* Department */}
      <div className="space-y-1">
        <Label className="text-xs">Department</Label>
        <Input
          value={fields.source_department ?? ''}
          onChange={e => setFields(f => ({ ...f, source_department: e.target.value || null }))}
          placeholder="e.g. Cardiology"
          className="h-8 text-xs"
        />
      </div>

      {/* Document date */}
      <div className="space-y-1">
        <Label className="text-xs">Document date</Label>
        <Input
          type="date"
          value={fields.document_date ?? ''}
          onChange={e => setFields(f => ({ ...f, document_date: e.target.value || null }))}
          className="h-8 text-xs"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={handleCancel} disabled={isPending}>
          <X size={11} />
          Cancel
        </Button>
      </div>
    </div>
  )
}
