'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { encodeImageForUpload } from '@/lib/capture/encode-image'
import { UPLOAD_MIME_TYPES, type CreateDocumentInput, type UploadMimeType } from '@/lib/validation/schemas'
import type { CreateDocumentResult } from '@/actions/documents'

type CaptureButtonProps = {
  profileId: string
  // Injected by the RSC page — never imported here (CLAUDE.md Hard Rule 9)
  createDocument: (input: CreateDocumentInput) => Promise<CreateDocumentResult>
  onCaptured?: () => void
}

const ACCEPT = UPLOAD_MIME_TYPES.join(',')

export function CaptureButton({ profileId, createDocument, onCaptured }: CaptureButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after a failed attempt
    if (!file) return

    setIsUploading(true)
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
          throw new Error('That file type is not supported')
        }
        mimeType = file.type as UploadMimeType
        blob = file
        width = null
        height = null
      }

      const signRes = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, mimeType }),
      })
      const signBody = await signRes.json()
      if (!signRes.ok) throw new Error(signBody.error ?? 'Could not prepare the upload')
      const { path, token } = signBody as { path: string; token: string }

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .uploadToSignedUrl(path, token, blob, { contentType: mimeType })
      if (uploadError) throw uploadError

      const result = await createDocument({
        profileId,
        blobKey: path,
        mimeType,
        byteSize: blob.size,
        width,
        height,
        idempotencyKey: crypto.randomUUID(),
      })
      if (!result.success) throw new Error(result.error)

      toast.success('Document captured')
      onCaptured?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not capture the document')
    } finally {
      setIsUploading(false)
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
        {isUploading ? 'Uploading…' : 'Capture document'}
      </Button>
    </>
  )
}
