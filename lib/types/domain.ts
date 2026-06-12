// Single source of truth for all DB-aligned union types.
// Every component, action, and AI schema imports from here — never redefines inline.
// Values mirror the Postgres enums in supabase/migrations/20240101000000_initial_schema.sql.

// ─── User / Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'coordinator' | 'patient'
export type PreferredLanguage = 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr'

// ─── Patient ──────────────────────────────────────────────────────────────────

export type AdmissionStatus = 'admitted' | 'outpatient'

// ─── Episode ──────────────────────────────────────────────────────────────────

export type EpisodeStatus = 'active' | 'care_complete' | 'closed'

// ─── Document ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'discharge_summary'
  | 'bill'
  | 'observation_note'
  | 'other'

export type DocumentStatus =
  | 'pending_classification'
  | 'classified'
  | 'translated'
  | 'failed'

export type TranslationStatus = 'pending' | 'translating' | 'complete' | 'failed'

// ─── AI pipeline data shapes ──────────────────────────────────────────────────

export type DocumentSummaryInput = {
  plain_language: string
  what_it_means: string
  document_type: DocumentType | 'document'
  document_date: string | null
}

// ─── Actions & Tasks ──────────────────────────────────────────────────────────

export type ActionFor = 'coordinator' | 'patient' | 'both'

export type TaskCategory =
  | 'insurance'
  | 'medication'
  | 'doctor_visit'
  | 'lifestyle'
  | 'test_results'
  | 'forms'
  | 'payment'

export type TaskPhase = 'during_care' | 'post_discharge'

export type TaskStatus = 'open' | 'resolved'
