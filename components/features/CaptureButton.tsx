'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { encodeImageForUpload } from '@/lib/capture/encode-image'
import { NonRetryableError, withRetry } from '@/lib/capture/with-retry'
import { UPLOAD_MIME_TYPES, type CreateDocumentInput, type UploadMimeType } from '@/lib/validation/schemas'
import type { CreateDocumentResult } from '@/actions/documents'

type CaptureButtonProps = {
  profileId: string
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  createDocument: (input: CreateDocumentInput) => Promise<CreateDocumentResult>
  onCaptured?: () => void
}

const ACCEPT = UPLOAD_MIME_TYPES.join(',')

const RETRY_OPTIONS = { retries: 2, baseDelayMs: 500 }

// Must match app/api/uploads/sign/route.ts's 429 body exactly — bulk capture
// uses this to recognize "the rate limit itself was hit" and stop queuing
// more files instead of burning through the rest of the batch on requests
// that will all fail the same way.
const RATE_LIMIT_MESSAGE = 'Too many uploads — try again later'

async function captureOneFile(
  file: File,
  profileId: string,
  createDocument: CaptureButtonProps['createDocument'],
  onRetryAttempt: (attempt: number) => void
): Promise<void> {
  const isImage = file.type.startsWith('image/')
  let mimeType: UploadMimeType
  let blob: Blob
  let width: number | null
  let height: number | null
  if (isImage) {
    const encoded = await encodeImageForUpload(file)
    mimeType = 'image/jpeg'
    blob = encoded.blob
    width = encoded.width
    height = encoded.height
  } else {
    if (!UPLOAD_MIME_TYPES.includes(file.type as UploadMimeType)) {
      throw new NonRetryableError('That file type is not supported')
    }
    mimeType = file.type as UploadMimeType
    blob = file
    width = null
    height = null
  }

  // Sign and upload are retried together (each attempt re-signs, so a
  // retry never reuses a possibly-already-consumed token) — a network
  // blip or a 5xx from either step is transient; a 4xx (bad request,
  // unauthenticated, unsupported type) is a real outcome and fails fast.
  const { path } = await withRetry(async (attempt) => {
    onRetryAttempt(attempt)
    const signRes = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, mimeType }),
    })
    const signBody = await signRes.json().catch(() => ({}))
    if (!signRes.ok) {
      const message = signBody?.error ?? 'Could not prepare the upload'
      if (signRes.status < 500) throw new NonRetryableError(message)
      throw new Error(message)
    }
    const { path, token } = signBody as { path: string; token: string }

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .uploadToSignedUrl(path, token, blob, { contentType: mimeType })
    if (uploadError) {
      const status = (uploadError as { status?: number }).status
      if (typeof status === 'number' && status < 500) throw new NonRetryableError(uploadError.message)
      throw uploadError
    }
    return { path }
  }, RETRY_OPTIONS)

  // Stable across retries: a retried createDocument call after a
  // dropped response replays the same idempotency_key, and the action's
  // unique-constraint-replay path (actions/documents.ts) returns the
  // already-created row instead of erroring.
  const idempotencyKey = crypto.randomUUID()
  const result = await withRetry(
    (attempt) => {
      onRetryAttempt(attempt)
      return createDocument({
        profileId,
        blobKey: path,
        mimeType,
        byteSize: blob.size,
        width,
        height,
        idempotencyKey,
      })
    },
    RETRY_OPTIONS
  )
  if (!result.success) throw new NonRetryableError(result.error)
}

export function CaptureButton({ profileId, createDocument, onCaptured }: CaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [queue, setQueue] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same file(s) after a failed attempt
    if (files.length === 0) return

    setIsUploading(true)
    setQueue({ done: 0, total: files.length })

    // One at a time, not in parallel: the sign route's per-user rate limit
    // (10/hour) is shared across every file in the batch, and processing
    // sequentially lets a 429 stop the rest of the queue immediately instead
    // of firing the remaining requests anyway and toasting the same failure
    // once per file.
    let succeeded = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        await captureOneFile(file, profileId, createDocument, setRetryAttempt)
        succeeded++
        onCaptured?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not capture the document'
        toast.error(files.length > 1 ? `${file.name}: ${message}` : message)
        if (message === RATE_LIMIT_MESSAGE) {
          setQueue({ done: files.length, total: files.length })
          break
        }
      }
      setRetryAttempt(0)
      setQueue({ done: i + 1, total: files.length })
    }

    if (files.length === 1) {
      if (succeeded === 1) toast.success('Document captured')
    } else if (succeeded > 0) {
      toast.success(`${succeeded} of ${files.length} documents captured`)
    }

    setIsUploading(false)
    setQueue({ done: 0, total: 0 })
  }

  const label =
    queue.total > 1
      ? `Capturing ${queue.done + (queue.done < queue.total ? 1 : 0)} of ${queue.total}…`
      : retryAttempt > 0
        ? `Retrying… (${retryAttempt}/${RETRY_OPTIONS.retries})`
        : isUploading
          ? 'Uploading…'
          : 'Capture document'

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {label}
      </Button>
    </>
  )
}
