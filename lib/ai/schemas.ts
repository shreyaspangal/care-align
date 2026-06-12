import { z } from 'zod'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'
import type { ActionFor, TaskCategory, TaskPhase } from '@/lib/types/domain'

// Re-export for callers that only need the inferred types
export type { ActionFor, TaskCategory, TaskPhase }

export const ClassificationSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  suggested_name: z.string(),
  // true when suggested_name is inferred rather than extracted verbatim from the document.
  // Stored alongside the name so the UI and audit trail can flag unverified labels.
  name_is_guessed: z.boolean(),
  suggested_purpose: z.string(),
  document_date: z.string().nullable(),
  source_hospital: z.string().nullable(),
  source_department: z.string().nullable(),
})

export type Classification = z.infer<typeof ClassificationSchema>

// Zod enums driven by the shared domain type values — kept in sync via the string literals
// that back both the TS union and the DB enum.
const actionForValues: [ActionFor, ...ActionFor[]] = ['coordinator', 'patient', 'both']
const taskCategoryValues: [TaskCategory, ...TaskCategory[]] = [
  'insurance',
  'medication',
  'doctor_visit',
  'lifestyle',
  'test_results',
  'forms',
  'payment',
]
const taskPhaseValues: [TaskPhase, ...TaskPhase[]] = ['during_care', 'post_discharge']

const ActionSchema = z.object({
  action_for: z.enum(actionForValues),
  category: z.enum(taskCategoryValues),
  phase_appears: z.enum(taskPhaseValues),
  description: z.string(),
})

export const TranslationSchema = z.object({
  plain_language: z.string(),
  what_it_means: z.string(),
  actions: z.array(ActionSchema),
})

export type Translation = z.infer<typeof TranslationSchema>
export type TranslationAction = z.infer<typeof ActionSchema>

export const EpisodeSummarySchema = z.object({
  visit_purpose: z.string(),
  timeline_summary: z.string(),
  status_label: z.string().max(50),
  status_description: z.string().max(200),
})

export type EpisodeSummary = z.infer<typeof EpisodeSummarySchema>
