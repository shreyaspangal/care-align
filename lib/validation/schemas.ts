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
})

// ─── Document Upload ──────────────────────────────────────────────────────────

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

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>
