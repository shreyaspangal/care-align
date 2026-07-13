import { z } from 'zod'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Full name is required.').trim(),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  role: z.enum(['coordinator', 'patient'], {
    error: () => ({ message: 'Please select a role.' }),
  }),
})

// ─── Patient ─────────────────────────────────────────────────────────────────

export const CreatePatientSchema = z.object({
  name: z.string().min(1, 'Patient name is required.').trim(),
  dob: z.string().min(1, 'Date of birth is required.'),
  gender: z.enum(['Male', 'Female', 'Other'], {
    error: () => ({ message: 'Please select a gender.' }),
  }),
  admission_status: z.enum(['admitted', 'outpatient']).default('admitted'),
  attested: z.literal(true, {
    error: () => ({ message: 'Please confirm before continuing.' }),
  }),
})

// ─── Document Upload ──────────────────────────────────────────────────────────

// Document types mirroring the DB enum. Used in the upload hint UI and classify step.
export const DOCUMENT_TYPES = [
  'prescription',
  'lab_report',
  'discharge_summary',
  'bill',
  'observation_note',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  prescription: 'Prescription',
  lab_report: 'Lab Report',
  discharge_summary: 'Discharge Summary',
  bill: 'Bill',
  observation_note: 'Observation Note',
  other: 'Other',
}

// Optional hints the coordinator can provide before upload.
// Both fields are optional — Claude fills any gap.
// custom_type is only present when type = 'other' and user typed a label;
// it is stored in documents.purpose, never as its own column.
export const UploadHintsSchema = z.object({
  type: z.enum([...DOCUMENT_TYPES] as [DocumentType, ...DocumentType[]]).optional(),
  custom_type: z.string().trim().max(100).optional(),
  source_hospital: z.string().trim().max(200).optional(),
})

export type UploadHints = z.infer<typeof UploadHintsSchema>

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export const DocumentFileSchema = z
  .instanceof(File)
  .refine((f) => f.size > 0, 'File is empty.')
  .refine((f) => f.size <= MAX_FILE_SIZE_BYTES, 'File is too large. Maximum size is 10 MB.')
  .refine(
    (f) => ALLOWED_MIME_TYPES.includes(f.type as AllowedMimeType),
    'File type not supported. Upload a PDF, JPG, PNG, or HEIC file.'
  )

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const ResolveTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID.'),
})

export const DeleteDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID.'),
})

export type ResolveTaskInput = z.infer<typeof ResolveTaskSchema>
export type DeleteDocumentInput = z.infer<typeof DeleteDocumentSchema>

// ─── Episode ──────────────────────────────────────────────────────────────────

// Only forward transitions are valid. active→care_complete→closed.
const VALID_EPISODE_TRANSITIONS = {
  active: 'care_complete',
  care_complete: 'closed',
} as const

export const UpdateEpisodeStatusSchema = z.object({
  episodeId: z.string().uuid('Invalid episode ID.'),
  newStatus: z.enum(['care_complete', 'closed'], {
    error: () => ({ message: 'Invalid episode status.' }),
  }),
}).refine(
  () => true, // transition legality is checked in the action against current DB state
)

export type UpdateEpisodeStatusInput = z.infer<typeof UpdateEpisodeStatusSchema>
export { VALID_EPISODE_TRANSITIONS }

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>
export type DocumentFileInput = z.infer<typeof DocumentFileSchema>
