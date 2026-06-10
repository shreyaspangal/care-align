'use client'

import { useRef, useState } from 'react'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { uploadDocument } from '@/actions/upload-document'
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES, validateDocumentFile } from '@/lib/storage/validate'

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; error: string }

type DocumentUploadZoneProps = {
  episodeId: string
  onUploadComplete?: (documentId: string) => void
}

export function DocumentUploadZone({ episodeId, onUploadComplete }: DocumentUploadZoneProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const validation = validateDocumentFile(file)
    if (!validation.ok) {
      setState({ status: 'error', error: validation.error })
      return
    }

    setState({ status: 'uploading', fileName: file.name })

    const formData = new FormData()
    formData.append('file', file)

    const result = await uploadDocument(episodeId, formData)

    if (result.ok) {
      setState({ status: 'idle' })
      toast.success(`${file.name} uploaded`, {
        description: 'AI classification is running in the background.',
        duration: 5000,
      })
      onUploadComplete?.(result.documentId)
    } else {
      setState({ status: 'error', error: result.error })
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-selected after an error
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const acceptTypes = ALLOWED_MIME_TYPES.join(',')
  const maxMb = MAX_SIZE_BYTES / (1024 * 1024)

  if (state.status === 'uploading') {
    return (
      <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 flex flex-col items-center gap-3 text-center bg-primary/5">
        <Loader2 className="animate-spin text-primary" size={28} />
        <div>
          <p className="text-sm font-medium">Uploading {state.fileName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Please wait…</p>
        </div>
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
  )
}
