// Shape of an eval case's `expected.json` (PRACTICES §6). Kept next to the
// scorer rather than in lib/validation/schemas.ts because it validates a
// developer-authored fixture file, not user input crossing a trust boundary.
//
// The expected-fields shape is DERIVED from OrganizeSchema (`.pick().partial()`)
// rather than re-typed by hand — Hard Rule 10's reasoning applied one level
// out: if a field's shape changes in the pipeline schema, the eval fixtures
// stop validating in the same commit instead of silently scoring the old shape.

import * as z from 'zod'
import { OrganizeSchema } from '@/lib/validation/schemas'

// Every key is optional and scored ONLY when present in the file. Omitting a
// key means "not scored" — which is how free-text fields (`title`,
// `what_it_says`, `terms`) stay out of accuracy scoring: there is no single
// correct string for them, so hand-authoring an exact expected value would be
// scoring the author's phrasing, not the model's fidelity. Those fields are
// still scanned by the boundary check, which is the constraint that matters
// for them (Hard Rule 1).
//
// Note the difference between an absent key and an explicit `null`: `null`
// means "the document does not print this — the model MUST return null"
// (Hard Rule 2, verbatim-or-null). That is a real, scored assertion.
export const ExpectedFieldsSchema = OrganizeSchema.pick({
  readable: true,
  doc_type: true,
  title_is_guessed: true,
  document_date: true,
  doctor_name: true,
  facility_name: true,
  patient_name_as_written: true,
  medications_as_written: true,
  tests_as_written: true,
}).partial()
export type ExpectedFields = z.infer<typeof ExpectedFieldsSchema>

export const EvalCaseSchema = z.object({
  case_id: z.string().min(1),
  // TRUE for every case in the repo today: these are synthetic fixtures that
  // prove the harness runs, NOT evidence about model quality. Real
  // founder-supplied anonymised documents replace them (eval/cases/README.md).
  placeholder: z.boolean(),
  // Free-text note explaining what this fixture is exercising.
  note: z.string(),
  // Relative to the case directory.
  source_file: z.string().min(1),
  mime_type: z.string().min(1),
  expected: ExpectedFieldsSchema,
})
export type EvalCase = z.infer<typeof EvalCaseSchema>
