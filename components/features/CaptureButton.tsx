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

export function CaptureButton({ profileId, createDocument, onCaptured }: CaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after a failed attempt
    if (!file) return

    setIsUploading(true)
    setRetryAttempt(0)
    try {
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
        setRetryAttempt(attempt)
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
          setRetryAttempt(attempt)
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

      toast.success('Document captured')
      onCaptured?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not capture the document')
    } finally {
      setIsUploading(false)
      setRetryAttempt(0)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {retryAttempt > 0
          ? `Retrying… (${retryAttempt}/${RETRY_OPTIONS.retries})`
          : isUploading
            ? 'Uploading…'
            : 'Capture document'}
      </Button>
    </>
  )
}
