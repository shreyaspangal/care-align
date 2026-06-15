'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type UploadHints,
} from '@/lib/validation/schemas'
import { validateDocumentFile } from '@/lib/storage/validate'

type UploadStage = 'uploading' | 'classifying' | 'translating' | 'summarising'

const PIPELINE_STAGES: { key: UploadStage; label: string; startAt: number }[] = [
  { key: 'uploading',   label: 'Uploading file',                startAt: 0  },
  { key: 'classifying', label: 'Classifying document',          startAt: 4  },
  { key: 'translating', label: 'Translating to plain language', startAt: 12 },
  { key: 'summarising', label: 'Updating episode summary',      startAt: 22 },
]

function getCurrentStage(elapsed: number): UploadStage {
  if (elapsed >= 22) return 'summarising'
  if (elapsed >= 12) return 'translating'
  if (elapsed >= 4)  return 'classifying'
  return 'uploading'
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; error: string }

type UploadResult = { ok: true; documentId: string } | { ok: false; error: string }

type DocumentUploadZoneProps = {
  episodeId: string
  onUpload: (episodeId: string, formData: FormData) => Promise<UploadResult>
  onUploadComplete?: (documentId: string) => void
}

const CUSTOM_TYPE_VALUE = '__custom__'

export function DocumentUploadZone({ episodeId, onUpload, onUploadComplete }: DocumentUploadZoneProps) {
  const router = useRouter()
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const [hints, setHints] = useState<UploadHints>({})
  const [showCustomType, setShowCustomType] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.status !== 'uploading') return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [state.status])

  async function handleFile(file: File) {
    const validation = validateDocumentFile(file)
    if (!validation.ok) {
      setState({ status: 'error', error: validation.error })
      return
    }

    setElapsed(0)
    setState({ status: 'uploading', fileName: file.name })

    const formData = new FormData()
    formData.append('file', file)
    if (hints.type) formData.append('hint_type', hints.type)
    if (hints.custom_type) formData.append('hint_custom_type', hints.custom_type)
    if (hints.source_hospital) formData.append('hint_source_hospital', hints.source_hospital)

    let result: UploadResult
    try {
      result = await onUpload(episodeId, formData)
    } catch {
      setState({ status: 'error', error: 'Upload failed. Please check your connection and try again.' })
      return
    }

    if (result.ok) {
      setState({ status: 'idle' })
      setHints({})
      setShowCustomType(false)
      toast.success(`${file.name} uploaded`, {
        description: 'AI classification is running in the background.',
        duration: 5000,
      })
      router.refresh()
      onUploadComplete?.(result.documentId)
    } else {
      setState({ status: 'error', error: result.error })
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  function handleTypeChange(value: string) {
    if (value === CUSTOM_TYPE_VALUE) {
      setHints(h => ({ ...h, type: 'other', custom_type: '' }))
      setShowCustomType(true)
    } else if (value === '') {
      setHints(h => ({ ...h, type: undefined, custom_type: undefined }))
      setShowCustomType(false)
    } else {
      setHints(h => ({ ...h, type: value as DocumentType, custom_type: undefined }))
      setShowCustomType(false)
    }
  }

  const acceptTypes = ALLOWED_MIME_TYPES.join(',')
  const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024)

  if (state.status === 'uploading') {
    const currentStage = getCurrentStage(elapsed)
    const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStage)

    return (
      <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 flex flex-col items-center gap-4 bg-primary/5">
        <Loader2 className="animate-spin text-primary" size={24} />
        <div className="w-full max-w-xs space-y-2">
          {PIPELINE_STAGES.map((stage, i) => {
            const isDone = i < currentIdx
            const isCurrent = i === currentIdx
            return (
              <div key={stage.key} className="flex items-center gap-2.5">
                {isDone ? (
                  <CheckCircle2 size={15} className="text-primary shrink-0" />
                ) : isCurrent ? (
                  <Loader2 size={15} className="animate-spin text-primary shrink-0" />
                ) : (
                  <Circle size={15} className="text-muted-foreground/30 shrink-0" />
                )}
                <span className={cn(
                  'text-sm',
                  isCurrent ? 'font-medium text-foreground' : isDone ? 'text-muted-foreground line-through' : 'text-muted-foreground/50'
                )}>
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">{state.fileName} · usually 20–30 seconds</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="border-2 border-destructive/30 bg-destructive/5 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="text-destructive" size={28} />
        <p className="text-sm font-medium text-destructive">{state.error}</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setState({ status: 'idle' })}
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Optional hint fields — shown above the drop zone */}
      <div className="grid grid-cols-2 gap-3">
        {/* Document type selector */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Document type <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <div className="relative">
            <select
              value={showCustomType ? CUSTOM_TYPE_VALUE : (hints.type ?? '')}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            >
              <option value="">AI will detect</option>
              {DOCUMENT_TYPES.filter(t => t !== 'other').map(t => (
                <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
              ))}
              <option value={CUSTOM_TYPE_VALUE}>Other (custom)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-muted-foreground" size={14} />
          </div>
          {showCustomType && (
            <Input
              placeholder="e.g. Referral Letter"
              value={hints.custom_type ?? ''}
              onChange={e => setHints(h => ({ ...h, custom_type: e.target.value }))}
              className="h-9 text-sm"
            />
          )}
        </div>

        {/* Hospital name */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Hospital <span className="text-muted-foreground/60">(optional)</span>
          </Label>
          <Input
            placeholder="AI will detect"
            value={hints.source_hospital ?? ''}
            onChange={e => setHints(h => ({ ...h, source_hospital: e.target.value || undefined }))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload document"
        className={cn(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-accent/30'
        )}
      >
        <Upload className="text-muted-foreground" size={28} />
        <div>
          <p className="text-sm font-medium">Drop a document here</p>
          <p className="text-xs text-muted-foreground mt-1">
            or <span className="underline underline-offset-4">browse files</span>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, JPG, PNG, HEIC · max {maxMb} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>
    </div>
  )
}
