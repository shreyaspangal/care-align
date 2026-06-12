import { z } from 'zod'

export const ClassificationSchema = z.object({
  type: z.enum([
    'prescription',
    'lab_report',
    'discharge_summary',
    'bill',
    'observation_note',
    'other',
  ]),
  suggested_name: z.string(),
  suggested_purpose: z.string(),
  document_date: z.string().nullable(),
  source_hospital: z.string().nullable(),
  source_department: z.string().nullable(),
})

export type Classification = z.infer<typeof ClassificationSchema>

const ActionSchema = z.object({
  action_for: z.enum(['coordinator', 'patient', 'both']),
  category: z.enum([
    'insurance',
    'medication',
    'doctor_visit',
    'lifestyle',
    'test_results',
    'forms',
    'payment',
  ]),
  phase_appears: z.enum(['during_care', 'post_discharge']),
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
