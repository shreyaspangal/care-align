'server-only'

import { generateText, Output, NoOutputGeneratedError } from 'ai'
import { AI_MODELS } from './models'
import { ClassificationSchema, type Classification } from './schemas'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'

// Derive the prompt doc-type list from the single source of truth.
const DOC_TYPE_DESCRIPTIONS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  prescription: 'medication instructions from a doctor',
  lab_report: 'results from blood, urine, imaging, or other diagnostic tests',
  discharge_summary: 'summary given when patient leaves hospital or completes care',
  bill: 'charges for medical services, room, procedures, or medication',
  observation_note: 'nursing or doctor notes about patient condition during stay',
  other: 'anything that does not fit the above',
}

const DOC_TYPE_LIST = DOCUMENT_TYPES.map(
  (t) => `- ${t}: ${DOC_TYPE_DESCRIPTIONS[t]}`
).join('\n')

function buildPrompt(hints?: { type?: string; hospital?: string }): string {
  let prompt = `You are classifying a medical document for a patient's health record.

Classify this document and return structured JSON only.

Document types:
${DOC_TYPE_LIST}

Rules:
- suggested_name: use the exact name as it appears on the document. If no name is visible, set name_is_guessed to true and provide a descriptive fallback (e.g. "Blood Report — date unknown"). Never invent a name and present it as extracted.
- name_is_guessed: set to true whenever suggested_name is inferred rather than read directly from the document. Set to false only when the name is an exact extraction.
- suggested_purpose: plain language description, e.g. "Pre-operation blood work".
- document_date: ISO date string (YYYY-MM-DD) if clearly printed on the document, null otherwise. Do not infer from context.
- source_hospital and source_department: null if not found on the document.
- If the document is not in English, classify type as "other" and set suggested_purpose to "Non-English document — translation not supported in V1".
- If the document image is unreadable or corrupt, do not guess. Return type "other", set suggested_purpose to "Document unreadable — please re-upload a clearer scan", and set all nullable fields to null.`

  if (hints?.type || hints?.hospital) {
    prompt += '\n\nThe coordinator provided these advisory hints — use them if the document confirms them, ignore them if the document contradicts them:'
    if (hints.type) prompt += `\n- Suggested type: ${hints.type}`
    if (hints.hospital) prompt += `\n- Suggested hospital: ${hints.hospital}`
  }

  return prompt
}

export async function classifyDocument(
  fileBuffer: Buffer,
  mimeType: string,
  hints?: { type?: string; hospital?: string }
): Promise<Classification> {
  const result = await generateText({
    model: AI_MODELS.classify,
    output: Output.object({ schema: ClassificationSchema }),
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(hints) },
          { type: 'file', data: fileBuffer, mediaType: mimeType },
        ],
      },
    ],
  })

  if (result.output === undefined) {
    throw new NoOutputGeneratedError()
  }

  return result.output
}
