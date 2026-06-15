'server-only'

import { generateText, Output, NoOutputGeneratedError } from 'ai'
import { AI_MODELS } from './models'
import { TranslationSchema, type Translation } from './schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('translate')

const PROMPT = (documentType: string, patientName: string) => `You are translating a medical document for a patient's family member.
The family member is not a medical professional.
The patient's name is ${patientName}.
This document is a ${documentType}.

Return structured JSON only. No preamble, no explanation outside the JSON object.
Do not wrap the JSON in markdown code fences.

Your job:
1. plain_language — explain what this document says in plain language a non-medical person can understand (min 2 sentences, max 8)
2. what_it_means — explain what this specifically means for ${patientName} (1–3 sentences)
3. actions — list actions that must be taken because of this document. Use an empty array if none are required.

Rules:
- No medical jargon without explanation
- No assumptions beyond what the document states
- No medical advice or treatment recommendations
- If something is unclear, say it is unclear — do not guess
- actions: [] is a valid and correct response when no action is required

Each action object must have exactly these four fields:

  description   — a single plain-language sentence telling the person exactly what to do
  action_for    — who must act: "coordinator" | "patient" | "both"
  phase_appears — when it applies: "during_care" | "post_discharge"
  category      — pick the single most specific match:
    "insurance"     — TPA authorisation, claim forms, policy queries
    "medication"    — collecting, administering, or refilling medicine
    "doctor_visit"  — scheduling or attending appointments
    "lifestyle"     — diet, exercise, rest, or daily routine changes
    "test_results"  — collecting or following up on lab or imaging results
    "forms"         — paperwork, consent forms, discharge documents
    "payment"       — bills, deposits, receipts, payment follow-ups`

export async function translateDocument(
  fileBuffer: Buffer,
  mimeType: string,
  documentType: string,
  patientName: string
): Promise<Translation> {
  let result
  try {
    result = await generateText({
      model: AI_MODELS.translate,
      output: Output.object({ schema: TranslationSchema }),
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT(documentType, patientName) },
            { type: 'file', data: fileBuffer, mediaType: mimeType },
          ],
        },
      ],
    })
  } catch (err) {
    // Output.object() internally throws NoObjectGeneratedError, which carries
    // a .text property with the raw model output. We read it here without
    // importing the deprecated class — ESLint only flags imports, not property access.
    const rawText = (err as { text?: string }).text
    log.error('translateDocument', 'Output.object() failed', {
      message: err instanceof Error ? err.message : String(err),
      rawOutput: rawText !== undefined ? rawText.slice(0, 500) : '(not available)',
    })
    throw err
  }

  if (result.output === undefined) {
    throw new NoOutputGeneratedError()
  }

  log.info('translateDocument', 'translation validated', {
    actionCount: result.output.actions.length,
  })

  return result.output
}
