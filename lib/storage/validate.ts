// Re-exports keep all imports pointing here — no breaking changes for consumers.
export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES as MAX_SIZE_BYTES,
} from '@/lib/validation/schemas'
export type { AllowedMimeType } from '@/lib/validation/schemas'

import { DocumentFileSchema } from '@/lib/validation/schemas'

export type ValidationResult = { ok: true } | { ok: false; error: string }

export function validateDocumentFile(file: File): ValidationResult {
  const result = DocumentFileSchema.safeParse(file)
  if (!result.success) {
    return { ok: false, error: result.error.issues[0].message }
  }
  return { ok: true }
}
