// The single home of every DB-aligned union type (CLAUDE.md Hard Rule 10).
// Each union mirrors a CHECK constraint in supabase/migrations — when a CHECK
// changes, this file changes in the same commit.

export const DOCUMENT_STATUSES = ['uploaded', 'organized', 'needs_review'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const DOC_TYPES = [
  'prescription',
  'lab_report',
  'imaging_report',
  'discharge_summary',
  'vaccination_record',
  'doctor_note',
  'bill',
  'other',
] as const
export type DocType = (typeof DOC_TYPES)[number]

export const APPOINTMENT_STATUSES = ['upcoming', 'done', 'cancelled'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const SEXES = ['female', 'male', 'other'] as const
export type Sex = (typeof SEXES)[number]

// Avatar hue for the profile picker — token namespaces, not raw colors
// (CLAUDE.md Hard Rule 13). DB default is 'accent'.
export const PROFILE_COLORS = ['accent', 'brand', 'ai', 'success'] as const
export type ProfileColor = (typeof PROFILE_COLORS)[number]

// Atomic, verbatim-or-null clinical facts stored in the document_explanations
// jsonb arrays (D-012). Defined once with their Zod validators and re-exported
// here so this stays the single import site for domain types (Rule 10). The
// Zod schema is the source; these types are its inference — they cannot drift.
export type { Term, Medication, LabTest } from '@/lib/validation/schemas'
